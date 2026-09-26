export function Avatar({name,size=40,className=""}: {name:string;size?:number;className?:string}) {
  const initials=name.split(/\s+/).slice(0,2).map(part=>part[0]).join("").toUpperCase();
  const hue=[...name].reduce((total,char)=>total+char.charCodeAt(0),0)%70+235;
  return <span className={`generated-avatar ${className}`} style={{width:size,height:size,"--avatar-hue":hue} as React.CSSProperties} aria-hidden="true">{initials}</span>;
}
