// Interpret the test form's wall-clock values in New York, independent of
// the browser's timezone. Reject DST gaps/overlaps rather than guessing.
export function newYorkTimeToISO(value) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) || Number(value.slice(0,4)) < 1970) {
    throw new Error('Enter a valid calendar date and time.');
  }
  const nominal = Date.parse(`${value}:00Z`);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year:'numeric', month:'2-digit',
    day:'2-digit', hour:'2-digit', minute:'2-digit', hourCycle:'h23'
  });
  const matches = [4,5].map(hours=>new Date(nominal + hours*3600000)).filter(date=>{
    if (Number.isNaN(date.getTime())) return false;
    const p=Object.fromEntries(formatter.formatToParts(date).map(x=>[x.type,x.value]));
    return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`===value;
  });
  if(matches.length!==1) throw new Error('This Eastern time is skipped or repeated by daylight saving time. Choose another time.');
  return matches[0].toISOString();
}
