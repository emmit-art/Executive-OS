export const TEST_CALENDAR='personal_icloud_family';
export function validateCalendar(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Calendar details are required.');
 const allowed=['calendar_account','title','start_at','end_at','timezone','location','notes','all_day'];
 if(Object.keys(input).some(k=>!allowed.includes(k)))throw new Error('Unexpected calendar fields.');
 if(input.calendar_account!==TEST_CALENDAR)throw new Error('Development calendar is limited to the connected Family Calendar.');
 if(typeof input.title!=='string'||!input.title.trim()||input.title.length>300||/[\0]/.test(input.title))throw new Error('Enter an event title (300 characters maximum).');
 if(typeof input.start_at!=='string'||Number.isNaN(Date.parse(input.start_at)))throw new Error('Enter a valid event start date and time.');
 if(typeof input.end_at!=='string'||Number.isNaN(Date.parse(input.end_at)))throw new Error('Enter a valid event end date and time.');
 if(![input.start_at,input.end_at].every(x=>/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(x)))throw new Error('Calendar dates must include an explicit timezone offset.');
 if(Date.parse(input.end_at)<=Date.parse(input.start_at))throw new Error('The event end must be after the start.');
 if(input.timezone!=='America/New_York')throw new Error('Development calendar must use America/New_York.');
 if(input.location!==undefined&&input.location!==null&&(typeof input.location!=='string'||input.location.length>500))throw new Error('Location must be 500 characters or fewer.');
 if(input.notes!==undefined&&input.notes!==null&&(typeof input.notes!=='string'||input.notes.length>20000))throw new Error('Notes must be 20,000 characters or fewer.');
 if(typeof input.all_day!=='boolean')throw new Error('All day must be true or false.');
 if(input.all_day)throw new Error('The development iPhone executor currently supports timed events only.');
 if(input.notes)throw new Error('Notes are not supported by the development iPhone executor.');
 return {calendar_account:input.calendar_account,title:input.title,start_at:input.start_at,end_at:input.end_at,timezone:input.timezone,location:input.location??'',notes:input.notes??'',all_day:input.all_day};
}
