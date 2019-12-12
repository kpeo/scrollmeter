const SM_DIST_MI = 1609.344;
const SM_DIST_LI = 500;
const SM_ALERT_DISTANCE = 100; //100 meters
const SM_INACTIVE = 1; //1 hour

// TODO: update SM on tab switching
var SM_stat = {};
/*
{ domain:
    {
        //basic data
        time: 0, // time of measurement
        len: 0, // current length
        
        //advanced data
        prevlen: 0, // [Reserved] previous length (before the reset at switching to new session because of inactivity)
        gap: 0, // gap of time in case of switching time back till the inactivity period exhaustion (will decrease inactivity time for cheaters)
        max: 0, // maximum value through the all
        maxtime: 0, // time of maximum value
        start: 0, // time of start scrolling
        stop: 0, // time of stop scrolling
    }
}
*/

var browser = chrome || browser;

var SM_inactive = SM_INACTIVE; //Estimate hours of inactivity to reset counters
var SM_resetstat = true; //Reset statistics on first presence
var SM_alertdistance = SM_ALERT_DISTANCE; //Alert distance in units (meters, miles, li)
var SM_unit = "m";

var SM_len_sum_trigger = false;
var SM_alert_trigger = false;
var SM_len_sum = 0.0;

function checkURL(url) {
    let parts = url.split(":", 2);
    if(parts[0] == "chrome" || parts[0] == "chrome-extension" || parts[1] == "about")
        return true;
    return false;
}

//convert internal presence (cm) to other units
function InternalToUnits(val, unit)
{
    var res;
    switch(unit) {
        case "mi":
            res = val/100/SM_DIST_MI;
            break;
        case "li":
            res = val/100/SM_DIST_LI;
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
            res = val * 100 * SM_DIST_MI;
            break;
        case "li":
            res = val * 100 * SM_DIST_LI;
            break;
        case "m":
        default:
            res = val * 100;
    }
    return res;
}

function getLenSum(stat) {
    var sum = 0;
    for (var i in stat) {
        if (stat.hasOwnProperty(i)) {
            var a = stat[i];
            sum += (a["len"] || 0);
        }
    }
    //console.debug( "GetLenSum: " + sum);
    return sum;
}

function initOptions(source)
{
    var SM_unit = localStorage.getItem("SM_unit");
    if(SM_unit === undefined || SM_unit === null) {
        SM_unit = "m";
        localStorage.setItem("SM_unit", "m");
    }
    console.debug("initOptions Unit: " + SM_unit);

    var rs = localStorage.getItem("SM_resetstat");
    if(rs === undefined || rs == null) {
        SM_resetstat = true;
        localStorage.setItem("SM_resetstat", true);
    }
    else {
        SM_resetstat = (rs == "true" )? true : false;
    }
    console.debug("initOptions ResetStat: " + SM_resetstat);

    rs = localStorage.getItem("SM_inactive");
    if(rs === undefined || rs == null) {
        SM_inactive = SM_INACTIVE;
        localStorage.setItem("SM_inactive", SM_INACTIVE);
    }
    else {
        SM_inactive = parseInt( rs );
    }
    console.debug("initOptions Inactive: " + SM_inactive);

    rs = localStorage.getItem("SM_alertdistance");
    if(rs === undefined || rs == null) {
        SM_alertdistance = 1;
        localStorage.setItem("SM_alertdistance", SM_ALERT_DISTANCE);
    }
    else {
        SM_alertdistance = UnitsToInternal( parseFloat( rs ), SM_unit );
    }
    console.debug("initOptions AlertDistance: " + SM_alertdistance);
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
        console.debug( "GetStat: SM_stat is empty" );
        var v = localStorage.getItem("SM_stat");

        if( v != undefined ) 
            SM_stat = JSON.parse(v);
        else {
            console.debug( "GetStat Storage.SM_stat is empty" );
            return false;
        }
    }
    return true;
}

function resetStat(stat) {
    for(var i in stat) {
        if(stat.hasOwnProperty(i)) {
            var len = CheckNull(stat[i].len);
            if(len > stat[i].max) {
                stat[i].max = len;
                stat[i].maxtime = stat[i].time;
            }
            stat[i].prevlen = len;
            stat[i].len = 0;
        }
    }
}

//Return the object - time difference and gap
function TimeDiff(cur_time, prev_time)
{
    var diff = {};

    if(cur_time == undefined || cur_time <= 0 ) {
        console.debug( 'TimeDiff: cur_time is empty or less/equal to zero' );
        return { time : 0, gap : 0};
    }
    
    if ( prev_time > cur_time ) {
        diff["gap"] = prev_time - cur_time;
        diff["time"] = prev_time - cur_time;
        console.debug( 'TimeDiff: Unexpexted time jump - using new time' );
    }
    else {
        diff["time"] = cur_time - prev_time;
        diff["gap"] = 0;
    }
//    console.debug( 'TimeDiff: ' + JSON.stringify(diff) + ', ' + Math.floor(diff.time / 3600000) + ', ' + Math.floor(diff.gap / 3600000) );
    return diff;
}

function checkInactive(curTime, curGap, inactiveTime) {
    var now = Date.now();
    var time_diff = TimeDiff( now, curTime );
    var time_diff_hours = Math.floor( (time_diff.time + time_diff.gap + cur.gap) / 3600000 ); // milliseconds to hours
//    var time_diff_hours = Math.floor( (time_diff.time + time_diff.gap + curGap) / 1000 ); // milliseconds to seconds
    //if( time_diff_hours > SM_inactive )
    if( time_diff_hours > inactiveTime )
        return true;
    else
        return false;
}

initOptions();

// Listeners
browser.tabs.onUpdated.addListener(function(tabId, changeInfo, tab){
    // Add icon to URL bar
    browser.pageAction.show(tabId);
});

browser.tabs.onActivated.addListener(function(info){
    browser.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if(tabs && tabs.length > 0) {
            if(!checkURL(tabs[0].url)) {
                console.debug("Activated tab=" + info.tabId + ", url=" + tabs[0].url);
                browser.tabs.sendMessage(info.tabId, {message: "SM_update"}, function(response){
                    if((response === undefined || response == null) && !ObjEmpty(browser.runtime.lastError)) {
                        console.warn("Please refresh the tabs or restart browser: " + browser.runtime.lastError.message);
                    }
                });
            }
        }
    });
});

browser.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    switch (request.message) {
        case "setOptions":
            // request from the content script to set the options.
            localStorage.setItem("SM_enabled", request.status);
            sendResponse({});
            break;

        case "getOptions":
            // request from the content script to get the options.
            sendResponse({SM_enabled: localStorage.getItem("SM_enabled")});
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
            sendResponse({});
            break;

        case "getUnit":
            var a = localStorage.getItem("SM_unit");
            if(a == undefined)
                a = "m";
            sendResponse({SM_unit: a});
            break;

        case "getTicks":
            var a = localStorage.getItem("SM_ticks");
            if(a == undefined)
                a = 23;
            sendResponse({SM_ticks: a});
            break;

        case "getDiameter":
            var a = localStorage.getItem("SM_diameter");
            if(a == undefined)
                a = 23;
            sendResponse({SM_diameter: a});
            break;

        case "getStat": //site
            if(request.site === undefined || request.site == null) {
                console.debug( "Background message [getStat]: key site is empty" );
                sendResponse( { SM_stat: null } );
                break;
            }
            //Return data for site from variable / storage
            if( !GetStat() ) {
                sendResponse( { SM_stat: null } );
                break;
            }
            console.debug("getStat: stat=" + JSON.stringify(SM_stat[request.site]) + ", sum=" + getLenSum(SM_stat));
            if(!SM_alert_trigger) {
                sendResponse( { SM_stat: JSON.stringify(SM_stat[request.site]), SM_sum: getLenSum(SM_stat) } );
            } else {
                sendResponse( { SM_stat: JSON.stringify(SM_stat[request.site]), SM_sum: getLenSum(SM_stat), SM_alert: { distance: InternalToUnits(SM_alertdistance, SM_unit), period: SM_inactive, unit: SM_unit } } );
            }
            break;

        case "setStat":
            if(request.site === undefined || request.site == null) {
                console.debug("Background message [setStat] key site is empty");
                sendResponse({});
                break;
            }
            var stat = (SM_stat && SM_stat[request.site])? SM_stat[request.site] : { time: 0, len: 0, prevlen: 0, gap: 0, max: 0, maxtime: 0, start: 0, stop: 0 };
            var time_diff = TimeDiff(request.time, stat.time);
            stat.prevlen = stat.len;
            stat.len = request.delta;
            stat.time = request.time;
            if (request.delta > stat.max) {
                 stat.max = request.delta;
                 stat.maxtime = request.time;
            }
            SM_stat[request.site] = stat;
            SM_len_sum = getLenSum(SM_stat);
            console.debug("setStat: stat=" + JSON.stringify(stat) + ", sum=" + SM_len_sum);
            localStorage.setItem( "SM_stat", JSON.stringify(SM_stat) );

            //check for alerts
            if(!SM_alert_trigger)
            {
                //console.debug( "Background message [setStat] SM_alert_trigger=false" );
                if((SM_len_sum || 0) > SM_alertdistance) {
                    console.log("Background message [setStat] Alert: " + stat["len"] + " > " + SM_alertdistance);
                    SM_alert_trigger = true;
                    if(sender && sender.tab && sender.tab.id) {
                        browser.tabs.sendMessage(sender.tab.id, {message: "SM_alert", distance: InternalToUnits(SM_alertdistance, SM_unit), period: SM_inactive, unit: SM_unit}, function(response) {
                            console.debug( "Background message [setStat] SM_alert_trigger=true" );
                        });
                    }
                }
            }
            if(SM_alert_trigger && SM_len_sum_trigger) {
                console.debug( "Background message [setStat] SM_alert_trigger & SM_len_sum_trigger enabled" );
                if(sender && sender.tab && sender.tab.id) {
                    browser.tabs.sendMessage(sender.tab.id, {message: "SM_reload"}, function(response) {
                        console.debug( "Background message [setStat] SM_len_sum_trigger=false" );
                        SM_len_sum_trigger = false;
                    });
                }
            }
            sendResponse({});
            break;
        case "checkInactive":
            if( request.site === undefined || request.site == null)
            {
                console.debug( "Background message [setStat] key site is empty" );
                sendResponse( { SM_stat: null } );
                break;
            }
            var cur = SM_stat[request.site];
            if(cur == undefined) {
                sendResponse({});
                break;
            }
            if( SM_alert_trigger && checkInactive(cur.time, cur.gap, SM_inactive) ) {
                //Reset len because of inactivity & reset counters (calculate it later in SetStat)
                console.debug( 'Background message [checkInactive] Cur time > Inactive period (' + SM_inactive + ')' );
                //Store max and reset counters
                console.debug( 'Background message [checkInactive] Store maximum: ' + cur.maxtime + ', ' + cur.max );
                //reset all the lens on first presence (for statistics)
                if(SM_resetstat) {
                    resetStat(SM_stat);
                }

                console.debug( "Background message [checkInactive] Store: " + JSON.stringify(cur) );
                localStorage.setItem( "SM_stat", JSON.stringify(SM_stat) );
                //SM_len_sum_trigger = true;
                if(sender && sender.tab && sender.tab.id) {
                    browser.tabs.sendMessage(sender.tab.id, {message: "SM_reload"}, function(response) {
                        console.debug( "Background message [checkInactive] SM_len_sum_trigger=false" );
                        SM_len_sum_trigger = false;
                    });
                }
            }
            sendResponse({});
            break;
        case "disableAlert":
            SM_alert_trigger = false;
        default:
            sendResponse({});
    }
});
