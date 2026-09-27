type MetricCardProps={label:string;value:string;detail:string;points:number[];tone?:"purple"|"pink"|"green"};

export function MetricCard({label,value,detail,points,tone="purple"}:MetricCardProps){
  const width=150,height=38;
  const min=Math.min(...points),max=Math.max(...points),range=max-min||1;
  const path=points.map((point,index)=>{
    const x=(index/(points.length-1))*width;
    const y=height-5-((point-min)/range)*(height-12);
    return `${index===0?"M":"L"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");
  return <article className={`metric-card tone-${tone}`}>
    <div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true"><path d={path}/></svg>
  </article>;
}
