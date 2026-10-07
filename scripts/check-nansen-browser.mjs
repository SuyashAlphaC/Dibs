import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {mkdir, mkdtemp, writeFile} from "node:fs/promises";
import {resolve} from "node:path";

const base = process.argv[2] ?? "https://dibs-metropolis.vercel.app";
const modalMode = process.argv.includes("--modals");
const artifacts = resolve(modalMode ? ".vercel/auth-modal-browser" : ".vercel/nansen-browser");
await mkdir(artifacts, {recursive: true});
const profile = await mkdtemp(resolve(artifacts, "profile-"));
const chrome = spawn("google-chrome", ["--headless", "--no-sandbox", "--disable-gpu", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], {stdio: ["ignore", "ignore", "pipe"]});
let socket;
try {
  const debuggingUrl = await new Promise((resolveUrl, reject) => {
    const timer = setTimeout(() => reject(new Error("Chrome startup timed out")), 15000);
    let output = "";
    chrome.stderr.on("data", chunk => {
      output += chunk.toString();
      const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) {clearTimeout(timer); resolveUrl(match[1]);}
    });
    chrome.once("error", error => {clearTimeout(timer); reject(error);});
  });
  socket = new WebSocket(debuggingUrl);
  await new Promise((resolveOpen, reject) => {socket.addEventListener("open", resolveOpen, {once: true}); socket.addEventListener("error", reject, {once: true});});
  let id = 0;
  const pending = new Map();
  const errors = [];
  socket.addEventListener("message", event => {
    const message = JSON.parse(event.data);
    if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text);
    if (process.env.NANSEN_BROWSER_DIAGNOSTICS === "true" && message.method === "Runtime.consoleAPICalled" && message.params.type === "error") console.error(message.params.args.map(arg => arg.value ?? arg.description).join(" "));
    if (message.id) {const job = pending.get(message.id); if (job) {pending.delete(message.id); clearTimeout(job.timer); message.error ? job.reject(new Error(message.error.message)) : job.resolve(message.result);}}
  });
  const call = (method, params = {}, sessionId) => new Promise((resolveCall, reject) => {
    const requestId = ++id;
    const timer = setTimeout(() => {pending.delete(requestId); reject(new Error(`${method} timed out`));}, 30000);
    pending.set(requestId, {resolve: resolveCall, reject, timer});
    socket.send(JSON.stringify({id: requestId, method, params, ...(sessionId ? {sessionId} : {})}));
  });
  const {targetId} = await call("Target.createTarget", {url: "about:blank"});
  const {sessionId} = await call("Target.attachToTarget", {targetId, flatten: true});
  const page = (method, params) => call(method, params, sessionId);
  await page("Runtime.enable"); await page("Page.enable");
  const evaluate = async expression => {
    const result = await page("Runtime.evaluate", {expression, returnByValue: true, awaitPromise: true});
    if (result.exceptionDetails) throw new Error("Browser evaluation failed");
    return result.result.value;
  };
  async function waitFor(expression) {
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {if (await evaluate(expression)) return; await new Promise(resolveWait => setTimeout(resolveWait, 250));}
    throw new Error("Expected Nansen UI did not become available");
  }
  if (modalMode) {
    const checks = [];
    const geometry = '(()=>{const element=document.querySelector("#privy-modal-content");const r=element.getBoundingClientRect();return{bodyZoom:getComputedStyle(document.body).zoom,appZoom:getComputedStyle(document.querySelector(".app-frame")).zoom,viewport:{width:innerWidth,height:innerHeight},modal:{x:r.x,y:r.y,width:r.width,height:r.height},offset:{x:r.x+r.width/2-innerWidth/2,y:r.y+r.height/2-innerHeight/2},overflow:document.documentElement.scrollWidth>innerWidth+1,insideDashboard:Boolean(element.closest(".app-frame"))}})()';
    for (const [name, width, height] of [["wide", 2048, 1242], ["desktop", 1920, 1080], ["laptop", 1366, 900], ["mobile", 390, 844]]) {
      await page("Emulation.setDeviceMetricsOverride", {width, height, deviceScaleFactor: 1, mobile: name === "mobile"});
      await page("Page.navigate", {url: `${base}/market/32`});
      await waitFor('document.querySelector(".connect-button")?.disabled === false');
      await evaluate('document.querySelector(".connect-button").click()');
      await waitFor('document.querySelector("#privy-modal-content")?.getBoundingClientRect().height > 50');
      await evaluate('new Promise(resolve=>setTimeout(resolve,600))');
      const login = await evaluate(geometry);
      assert.equal(Number(login.bodyZoom), 1);
      assert.equal(Number(login.appZoom), width >= 1600 ? 1.5 : 1);
      assert.equal(login.insideDashboard, false);
      assert.equal(login.overflow, false);
      assert(Math.abs(login.offset.x) < 2, `${name}: Privy sign-in must be horizontally centered`);
      if (width > 440) assert(Math.abs(login.offset.y) < 2, `${name}: Privy sign-in must be vertically centered`);
      assert(login.modal.y >= -1 && login.modal.y + login.modal.height <= height + 1, `${name}: modal must fit the viewport`);
      let farcaster = null;
      if (width > 440) {
        const opened = await evaluate('(()=>{const button=[...document.querySelectorAll("#privy-modal-content button")].find(button=>/farcaster/i.test(button.textContent||button.getAttribute("aria-label")||""));if(!button)return false;button.click();return true})()');
        assert(opened, "Farcaster sign-in option must be present");
        await waitFor('/Sign in with Farcaster/i.test(document.querySelector("#privy-modal-content")?.textContent||"")');
        await evaluate('new Promise(resolve=>setTimeout(resolve,600))');
        farcaster = await evaluate(geometry);
        assert(Math.abs(farcaster.offset.x) < 2 && Math.abs(farcaster.offset.y) < 2, `${name}: Farcaster modal must be centered`);
        assert(farcaster.modal.y >= -1 && farcaster.modal.y + farcaster.modal.height <= height + 1);
      }
      checks.push({viewport: name, login, farcaster});
    }
    assert.deepEqual(errors, [], "Unexpected browser runtime errors");
    const verification = {base, checkedAt: new Date().toISOString(), checks, runtimeExceptions: errors, authenticated: false, transactionsSent: 0};
    await writeFile(resolve(artifacts, "verification.json"), JSON.stringify(verification, null, 2) + "\n");
    console.log(JSON.stringify(verification));
  } else {
  const checks = [];
  for (const [name, width, height] of [["desktop", 1366, 900], ["mobile", 390, 844]]) {
    await page("Emulation.setDeviceMetricsOverride", {width, height, deviceScaleFactor: 1, mobile: name === "mobile"});
    await page("Page.navigate", {url: `${base}/intelligence`});
    await waitFor('document.querySelectorAll(".conviction-lens").length === 2 && document.body.innerText.includes("Recorded genuine API evidence")');
    await waitFor('document.querySelector(".connect-button")?.disabled === false');
    const result = await evaluate('({historical: document.body.innerText.includes("historical snapshot"), fixture: document.body.innerText.includes("synthetic wallets and relationships"), requests: document.querySelectorAll("#lens-title-32").length, overflow: document.documentElement.scrollWidth > innerWidth + 1, forms: document.querySelectorAll(".lens-toolbar").length, headings: document.querySelectorAll("h1").length})');
    assert(result.historical && result.fixture); assert.equal(result.requests, 1); assert.equal(result.forms, 0); assert.equal(result.headings, 1); assert.equal(result.overflow, false);
    const review = await evaluate('(()=>{const real=document.querySelector("#conviction-lens"),fixture=[...document.querySelectorAll(".conviction-lens")][1];const link=fixture.querySelector(".lens-review-steps a[href*=lens-evidence]");link.click();const opened=fixture.querySelector("details").open;fixture.querySelector("details").open=false;return{briefs:document.querySelectorAll(".lens-brief").length,historicalUnknown:real.querySelector(".lens-brief").textContent.includes("not verified independence"),fixtureGroups:fixture.querySelectorAll(".lens-groups article").length,sharedLines:fixture.querySelectorAll(".lens-connection.shared").length,sourceProofs:fixture.querySelectorAll(".lens-shared-evidence .lens-transactions li>div").length,fixtureExplorerLinks:fixture.querySelectorAll(".lens-transactions a").length,reviewLinkOpenedEvidence:opened}})()');
    assert.equal(review.briefs, 2); assert(review.historicalUnknown && review.reviewLinkOpenedEvidence, JSON.stringify(review)); assert.equal(review.fixtureGroups, 1); assert.equal(review.sharedLines, 1); assert.equal(review.sourceProofs, 2); assert.equal(review.fixtureExplorerLinks, 0);
    await waitFor('document.querySelector(".lens-map svg").getBoundingClientRect().height > 200');
    await evaluate('(async()=>{await document.fonts.ready;document.querySelector(".conviction-lens").scrollIntoView({block:"start",behavior:"instant"});await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));})()');
    await waitFor('(()=>{const top=document.querySelector(".conviction-lens").getBoundingClientRect().top;return top>=0 && top<150})()');
    const screenshot = await page("Page.captureScreenshot", {format: "png"});
    await writeFile(resolve(artifacts, `${name}.png`), Buffer.from(screenshot.data, "base64"));
    checks.push({viewport: name, ...result, review});
  }
  await page("Page.navigate", {url: `${base}/market/32`});
  await waitFor('document.querySelector(".lens-toolbar") && document.body.innerText.includes("Sign in to inspect conviction")');
  await waitFor('document.querySelector(".lens-toolbar button")?.disabled === false');
  const boundaries = await evaluate('(async()=>{const url="/api/intelligence/market/32";const configResponse=await fetch(url);const config=await configResponse.json();const unauthenticated=await fetch(url,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({chain:"base"})});return{configurationStatus:configResponse.status,enabled:config.enabled,configured:config.configured,unauthenticatedStatus:unauthenticated.status}})()');
  assert.equal(boundaries.configurationStatus, 200); assert(boundaries.enabled && boundaries.configured); assert.equal(boundaries.unauthenticatedStatus, 401); assert.deepEqual(errors, [], "Unexpected browser runtime errors");
  const verification = {base, checkedAt: new Date().toISOString(), checks, boundaries, runtimeExceptions: errors, paidQueriesMade: 0, authenticatedUserFlowVerified: false};
  await writeFile(resolve(artifacts, "verification.json"), JSON.stringify(verification, null, 2) + "\n");
  console.log(JSON.stringify(verification));
  }
} finally {socket?.close(); chrome.kill("SIGTERM");}
