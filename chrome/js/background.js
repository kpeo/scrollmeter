// TODO: update SM on tab switching
var SM_stat = {}; 
/*
{ 'domain' : 
	{
		//basic data
		'time': 0, // time of measurement
		'len' : 0, // current length
		
		//advanced data
		'prevlen' : 0, //[Reserved] previous length (before the reset at switching to new session because of inactivity)
		'timegap' : 0, // gap of time in case of switching time back till the inactivity period exhaustion (will decrease inactivity time for cheaters)
		'max' : 0, //maximum value through the all 
		'maxtime' : 0, //time of maximum value
	}
}
*/

var SM_inactive = 6; //Estimate hours of inactivity to reset counters
var SM_resetstat = true; //Reset statistics on first presence
var SM_alertdistance = 1; //unit
var SM_unit = "m";

var SM_day_trigger = false;
var SM_alert_trigger = false;
var SM_day_stat;

// Add icon to URL bar
function checkUrl(tabId, changeInfo, tab) {
	chrome.pageAction.show(tab.id);
};

// Listen for any changes to the URL of any tab
chrome.tabs.onUpdated.addListener(checkUrl);

initOptions();

//convert internal presence (cm) to other units
function InternalToUnits(val, unit)
{
	var res;
	switch(unit) {
		case "mi":
			res = val/100/1609.344;
			break;
		case "li":
			res = val/100/500;
			break;
		case "m":
		default:
			res = val/100;
	}
	return res;
}

//convert units to internal presence (cm) to other units
function UnitsToInternal(val, unit)
{
	var res;
	switch(unit) {
		case "mi":
			res = val*100*1609.344;
			break;
		case "li":
			res = val*100*500;
			break;
		case "m":
		default:
			res = val * 100;
	}
	return res;
}

function initOptions(source)
{
	var SM_unit = localStorage["SM_unit"];
	if(SM_unit == undefined)
		SM_unit = "m";
	console.log("SM_unit: " + SM_unit);

	var rs = localStorage["SM_resetstat"];
	if(rs == undefined)
		SM_resetstat = true;
	else
		SM_resetstat = parseInt( rs )? true : false;
//	console.log("ResetStat: " + SM_resetstat);

	rs = localStorage["SM_inactive"];
	if(rs == undefined)
		SM_inactive = 6;
	else
		SM_resetstat = parseInt( rs );
//	console.log("Inactive: " + SM_inactive);

	rs = localStorage["SM_alertdistance"];
	if(rs == undefined)
		SM_alertdistance = 1;
	else
		SM_alertdistance = UnitsToInternal( parseFloat( rs ), SM_unit );
	console.log("AlertDistance  storage: " +rs + ", output: " + SM_alertdistance);
	if(source != "tab")
		SM_alert_trigger = false;
}

//Check and set the object
function CheckNull( obj ) {
	return (obj !== undefined && obj != null)?obj:0;
}

//Tests if object is empty
function ObjEmpty(obj) {
	for(var prop in obj) {
		if(obj.hasOwnProperty(prop))
			return false;
	}
	return true;
}

// Save the item to the localstorage
function setItem(key, value) {
	window.localStorage.removeItem(key);
	window.localStorage.setItem(key, value);
}

// Get the item from local storage with the specified key
function getItem(key) {
	var value;
	try {
		value = window.localStorage.getItem(key);
	}
	catch(e) {
		value = "null";
	}
	return value;
}

//Get the recent SM_stat (local variable or storage)
//Set local variable from storage if empty
//Returns false if SM_stat and Storage.SM_stat is empty
function GetStat()
{
	if(SM_stat == undefined || ObjEmpty(SM_stat))
	{
//		console.log( "SM_stat is empty" );
		var v = localStorage["SM_stat"];

		if( v != undefined ) 
			SM_stat = JSON.parse(v);
		else {
//			console.log( "Storage.SM_stat is empty" );
			return false;
		}
	}
	return true;
}

//Return the object - time difference and gap
function TimeDiff(cur_time, prev_time)
{
	var diff = {};

	if(cur_time == undefined || cur_time <= 0 ) {
//		console.log( 'TimeDiff: cur_time is empty or less/equal to zero' );
		return { time : 0, gap : 0};
	}
	
	if ( prev_time > cur_time ) {
		diff["gap"] = prev_time - cur_time;
		diff["time"] = prev_time - cur_time;
//		console.log( 'Unexpexted time switching - using new time' );
	}
	else {
		diff["time"] = cur_time - prev_time;
		diff["gap"] = 0;
	}
//	console.log( 'TimeDiff: ' + JSON.stringify(diff) + ', ' + Math.floor(diff.time / 3600000) + ', ' + Math.floor(diff.gap / 3600000) );
	return diff;
}

// Listeners
chrome.extension.onMessage.addListener(

	function(request, sender, sendResponse)
	{
		switch (request.name)
		{
			case "setOptions":
				// request from the content script to set the options.
				localStorage.setItem("SM_enabled", request.status);
			break;

			case "getOptions":
				// request from the content script to get the options.
				sendResponse({SM_enabled : localStorage["SM_enabled"]});
			break;

			case "loadOptions":
				if(request.source === undefined || request.source == null) {
					sendResponse({});
					break;
				}
				//Init options
				initOptions(request.source);
				sendResponse({});
			break;

			case "setUnit":
				localStorage.setItem("SM_unit", request.unit);
			break;

			case "getUnit":
				var a = localStorage["SM_unit"];
				if(a == undefined)
					a = "m";
				sendResponse({SM_unit : a});
			break;

			case "getTicks":
				var a = localStorage["SM_ticks"];
				if(a == undefined)
					a = 23;
				sendResponse({SM_ticks : a});
			break;

			case "getDiameter":
				var a = localStorage["SM_diameter"];
				if(a == undefined)
					a = 23;
				sendResponse({SM_diameter : a});
			break;

			case "getStat": //site
				if(request.site === undefined || request.site == null) {
//					console.log( "key site is empty" );
					sendResponse( { SM_stat : null } );
					break;
				}
				//Return data for site from variable / storage
				if( !GetStat() ) {
					sendResponse( { SM_stat : null } );
					break;
				}

				//Check the inactivity time
				var cur = SM_stat[request.site];
//				console.log( "cur:" + JSON.stringify(cur) );

				if(cur == undefined) {
					sendResponse( { SM_stat : null } );
					break;
				}

				if(!SM_day_trigger)
				{
					//Check the recent saved time from local variable
					var now = Date.now();
					var time_diff = TimeDiff( now, cur.time );
					var time_diff_hours = Math.floor( (time_diff.time + time_diff.gap + cur.gap) / 3600000 ); // milliseconds to hours

					if( time_diff_hours > SM_inactive )
					{
//						console.log( 'Time diff (' + time_diff_hours + ') > Inactive period (' + SM_inactive + ')' );
						// reset counters (calculate it later in SetStat)
						cur["len"] = 0;
						SM_day_trigger = true;
					}
				}
				sendResponse( { SM_stat : JSON.stringify(SM_stat[request.site]) } );
				
			break;

			case "getStatDay": //site
				//Return data for site from variable / storage
				if( !GetStat() ) {
					sendResponse( { SM_stat : null } );
					break;
				}
				var sum = 0;
				if(!SM_day_trigger) //already triggered
				{
					if(request.site === undefined || request.site == null) {
//						console.log( "key site is empty" );
						sendResponse( { SM_stat : null } );
						break;
					}
					//Check the inactivity time
					var cur = SM_stat[request.site];
//					console.log( "cur:" + JSON.stringify(cur) );

					if(cur == undefined) {
						sendResponse( { SM_stat : null } );
						break;
					}

					//Check the recent saved time from local variable
					var now = Date.now();
					var time_diff = TimeDiff( now, cur.time );
					var time_diff_hours = Math.floor( (time_diff.time + time_diff.gap + cur.gap) / 3600000 ); // milliseconds to hours

					if( time_diff_hours > SM_inactive )
					{
//						console.log( 'Time diff (' + time_diff_hours + ') > Inactive period (' + SM_inactive + ')' );
						// reset counters (calculate it later in SetStat)
						SM_day_trigger = true;
					}
					else {
						// Summarize the values through the all sites
						for(var i in SM_stat) {
							if(SM_stat.hasOwnProperty(i)) {
								var a = SM_stat[i];
								sum += a["len"];
//								console.log( "Sum: " + sum);
							}
						}
					}
				}
				SM_day_stat = sum;
				sendResponse( { SM_stat_day : sum } );
			break;

			case "setStat": //site, stat
				var success = false
				if( request.site === undefined || request.site == null)
				{
//					console.log( "key site is empty" );
					sendResponse( { SM_stat : null } );
					break;
				}
				if(request.stat === undefined || request.stat == null)
				{
//					console.log( "key stat is empty");
					sendResponse( { SM_stat : null } );
					break;
				}
				
				//check the new day
				var cur = JSON.parse(request.stat);
//				console.log( "cur:" + JSON.stringify(cur) );

				if(cur == undefined) {
					sendResponse( {} );
					break;
				}
				
				var prev = SM_stat[request.site];
//				console.log( "prev:" + JSON.stringify(prev) );
				
				//Check the recent saved time from local variable
				if(prev != undefined)
				{
					//Check reset or clock changes
					cur.time = CheckNull(cur.time);
					prev.time = CheckNull(prev.time);
					prev.gap = CheckNull(prev.gap);
					prev.max = CheckNull(prev.max);
					prev.maxtime = CheckNull(prev.maxtime);
					prev.prevlen = CheckNull(prev.prevlen);
					
					var time_diff = TimeDiff( cur.time, prev.time );
					cur["gap"] = time_diff.gap + prev.gap; //several switching
					cur["max"] = prev.max;
					cur["maxtime"] = prev.maxtime;
					cur["prevlen"] = prev.prevlen;

					//Switch len because of inactivity
					var time_diff_hours = Math.floor( (time_diff.time + cur.gap ) / 3600000 ); // milliseconds to hours
//					console.log( 'Time diff hours: ' + time_diff_hours );

					if( time_diff_hours > SM_inactive )
					{
//						console.log( 'Time diff (' + time_diff_hours + ') > Inactive period (' + SM_inactive + ')' );

						//Store max and reset counters
						prev.len = CheckNull(prev.len);
						cur.len = CheckNull(cur.len);
						
						if( cur.len > prev.len ) 
						{
							if(cur.len > prev.max) {
								cur["max"] = cur.len;
								cur["maxtime"] = cur.time;
							}
							cur["prevlen"] = prev.len;
							cur["len"] = cur.len - prev.len;
						}
						else { //Unexpected behaviour - use previous len
//							console.log( 'Unexpected: cur.len (' + cur.len + ') < prev.len(' + prev.len + ')' );
							if(prev.len > prev.max) {
								cur["max"] = prev.len;
								cur["maxtime"] = prev.time;
							}
							cur["prevlen"] = prev.time = prev.len;
							cur["len"] = 0;
							if( cur.time < prev.time )
								cur["time"] = Date.now(); // http://jsperf.com/date-now-vs-new-date-gettime/8
						}
						cur["gap"] = 0;
//						console.log( 'Store maximum:' + cur.maxtime + ', ' + cur.max );
						//reset all the lens on first presence (for statistics)
						if(SM_resetstat)
						{
							for(var i in SM_stat) {
								if(SM_stat.hasOwnProperty(i)) {
									var a = SM_stat[i];
									a.len = CheckNull(a.len);

									if(a.len > a.max) {
										a["max"] = a.len;
										a["maxtime"] = a.time;
									}
									a["prevlen"] = a.len;
									a["len"] = 0;

								}
							}
						}
						SM_day_trigger = true;
					}
				}
				//check for alerts
				if(!SM_alert_trigger)
				{
					if(cur["len"] + SM_day_stat > SM_alertdistance) {
						console.log("Alert: " + cur["len"] + " > " + SM_alertdistance);
						SM_alert_trigger = true;
						alert("You just passed " + InternalToUnits(SM_alertdistance, SM_unit) + " " + SM_unit + "! Take a break, please.");
					}
				}
//				console.log( "Store:" + JSON.stringify(cur) );
				SM_stat[request.site] = cur;
				localStorage.setItem( "SM_stat", JSON.stringify(SM_stat) );
				if(SM_day_trigger) {
					SM_day_trigger = false;
					chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
						chrome.tabs.sendMessage(tabs[0].id, {name: "SM_reload"}, function(response) {});
					});
				}
				sendResponse( { SM_stat : null } );
			break;

			default:
			sendResponse({});
		}
	}
);