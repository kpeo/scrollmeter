var SM_position = "right";
var SM_node = null;

var SM_ticks = 23; //mouse wheel tick counts per revolution
var SM_diameter = SM_ticks; //mouse wheel diameter
var SM_length = Math.PI*SM_diameter; //mm per length of wheel circle (usually diameter = number of ticks)

var SM_step = SM_length/SM_ticks/10; //cm per one tick

var background; //f or popup only
var SM_unit;
var SM_stat = null;
var SM_stat_day = null;

var SM_value = 0;

//Get and set i18n message for object
function getMessage(id, name) {
	var message = chrome.i18n.getMessage(name);
	document.getElementById(id).innerHTML = message;
}

//Calculates decimals count of n to fit into size count of digits
function FitNumber(n,size)
{
	var a = n.toFixed();
	var b = a.length;
	if( size < b )
		return a;
	return n.toFixed(size-b);
}

//form the JSON with value (val) started with site (full=true) or day (full=false)
function GetStatJSON( val, full )
{
	var domain = window.location.hostname;
	var v = {};
	var vv = {};

	vv["time"] = Date.now();
	vv["len"] = val;
	v[domain] = vv;
	return full?v:vv;
}

//save statistic to local storage
function SetStat(len)
{
	var domain = window.location.hostname;
	var vv = GetStatJSON(len,false);
	var v = JSON.stringify(vv);

//	console.log("SetStat:" + v + ", value:" + len);
	chrome.extension.sendMessage({name: "setStat", site: domain, stat: v}, function(response) {});
}

//convert internal presence (cm) to other units
function ConvertUnits(val,unit)
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

//Render current SM element
function BuildSM(par, val, val2, unit)
{
	var subdiv = [];
	var t;

	for( i=0; i<3; i++ ) {
		subdiv[i] = document.createElement("DIV");
		subdiv[i].id = par.id + '-v'+i;
		switch(i) {
			case 0:
				t = document.createTextNode( FitNumber(val,7) );
				subdiv[0].appendChild(t);
				break;
			case 1:
				t = document.createTextNode( FitNumber(val2,7) );
				subdiv[1].appendChild(t);
				break;
			case 2:
				t = document.createTextNode( unit );
				subdiv[2].appendChild(t);
		}
		par.appendChild(subdiv[i]);
	}
}

function deleteSM(el)
{
	var b = document.getElementsByTagName('body')[0];
	if (b.id == "SM_popup")
		b = document.getElementsByTagName('body')[1];
	if(b != undefined) {
		var elem = document.getElementById(el);
		if(elem != undefined)
			b.removeChild(elem);
	}
}

function CreateSM(el, position, val, val2, unit)
{
	var elem = null;
	var res = ConvertUnits(val, unit);
	var res2 = ConvertUnits(val2, unit);
	var b = document.getElementsByTagName('body')[0];
	if (b.id == "SM_popup")
		b = document.getElementsByTagName('body')[1];
	if(b != undefined) {
		var div = document.createElement("DIV");
		div.id = el;
		div.className = el+'-'+position;
		BuildSM( div, res, res2, unit );
		elem = b.appendChild(div);
	}
	return elem;
}

function UpdateSM(el, val, val2, unit)
{
	var res = ConvertUnits(val, unit);
	var res2 = ConvertUnits(val2, unit);

	//remove the values
	while (el.firstChild) 
		el.removeChild(el.firstChild);

	BuildSM( el, res, res2, unit );
}

function loadOptions() {
	chrome.extension.sendMessage({name: "getOptions"}, function(response) {
		// set Disable as default
		if ( response.SM_enabled === undefined || response.SM_enabled == null )
			chrome.extension.sendMessage({name: "setOptions", status: 'Disable'}, function(response) {});
	});

	//load other options
	chrome.extension.sendMessage({name: "loadOptions", source: "tab"}, function(response) {});
}

//Main process
function MouseWheelHandler(e) {
	e = window.event || e;

	var res;
	var delta = Math.max(-1, Math.min(1, (e.wheelDelta || -e.deltaY || -e.detail)));
	var direction = (e.detail<0 || e.wheelDelta>0) ? 1 : -1;

	var d = window.location.hostname;

	if( SM_unit == undefined )
		return false;
	if(SM_node == undefined)
		return false;
		// Get current site/day statistics
	if(SM_stat == undefined || SM_stat == null) {
		chrome.extension.sendMessage({name: "getStat", site: d}, function(response) {
			if ( typeof response == 'undefined' || typeof response.SM_stat == 'undefined' || response.SM_stat == null ) {
				SM_stat = GetStatJSON(0,false);
//				console.log( "SM_stat0:" + JSON.stringify(SM_stat) );
			}
			else{
				SM_stat = JSON.parse(response.SM_stat);
//				console.log( "SM_stat:" + JSON.stringify(SM_stat) );
			}

			// Get current day statistics
			if(SM_stat_day == undefined || SM_stat_day == null) {
				chrome.extension.sendMessage({name: "getStatDay", day: day}, function(response) {
					if ( typeof response == 'undefined' || typeof response.SM_stat_day == 'undefined' || response.SM_stat_day == null ) 
						SM_stat_day = 0;
					else
						SM_stat_day = response.SM_stat_day;
					
//					console.log( "SM_stat_day:" + SM_stat_day );

					wheelUnits = (SM_stat["len"] || 0) + Math.abs(delta)*wheelStep;
					SetStat(wheelUnits);
					UpdateSM(SM_node, wheelUnits, SM_stat_day, SM_unit);
					return false;
				});
			}
		});
	}

	// Get current day statistics
	if( SM_stat_day == undefined || SM_stat == undefined ) {
//		console.log(background.SM_day_trigger);
		chrome.extension.sendMessage( { name: "getStatDay", site: d }, function(response) {
			if ( response.SM_stat_day === undefined || response.SM_stat_day == null ) 
				SM_stat_day = 0;
			else
				SM_stat_day = response.SM_stat_day;
//			console.log( "SM_stat_day:" + SM_stat_day );
		});
		
		if( SM_stat == undefined )
		{
			chrome.extension.sendMessage({name: "getStat", site: d}, function(response) {
				if ( response.SM_stat === undefined || response.SM_stat == null ) {
					SM_stat = GetStatJSON(0, false);
//					console.log( "SM_stat0:" + JSON.stringify(SM_stat) );
				}
				else{
					SM_stat = JSON.parse(response.SM_stat);
//					console.log( "SM_stat:" + JSON.stringify(SM_stat) );
				}
				SM_value = SM_stat.len + Math.abs(delta)*SM_step;
				SetStat(SM_value);
				UpdateSM(SM_node, SM_value, SM_stat_day, SM_unit);
//				console.log(SM_value);
				return false;
			});
		}
	}

	SM_value += Math.abs(delta)*SM_step;

	SetStat(SM_value);
	UpdateSM(SM_node, SM_value, SM_stat_day+SM_value, SM_unit);
//	console.log(SM_value);
	return false;
}

//Initial process
var smInit = function()
{
	var d = window.location.hostname;
	var SM_start = {};
	var SM_start_day = {};

	chrome.extension.sendMessage({name: 'getTicks'}, function(response) {
		if ( response.SM_ticks === undefined || response.SM_ticks == null )
			SM_ticks = 23; //default
		else
			SM_ticks = parseInt( response.SM_ticks );
//		console.log("main_ticks: " + SM_ticks);
	});

	chrome.extension.sendMessage({name: 'getDiameter'}, function(response) {
		if ( response.SM_diameter === undefined || response.SM_diameter == null )
			SM_diameter = 23; //default
		else
			SM_diameter = parseInt( response.SM_diameter );
//		console.log("main_diameter: " + SM_diameter);
	});

	chrome.extension.sendMessage({name: 'getUnit'}, function(response) {
		if ( response.SM_unit === undefined || response.SM_unit == null )
			SM_unit = "m"; //default
		else
			SM_unit = response.SM_unit;
//		console.log("main_unit: " + SM_unit);

		chrome.extension.sendMessage({name: "getStat", site: d}, function(response) {
			if ( response.SM_stat === undefined || response.SM_stat == null )
				SM_start = SM_stat = GetStatJSON(0,false);
			else {
				SM_start = SM_stat = JSON.parse(response.SM_stat);
				SM_value = SM_stat.len;
			}
//			console.log( "main_start:" + JSON.stringify(SM_start) );

			chrome.extension.sendMessage( { name: "getStatDay", site: d }, function(response) {
				if ( response.SM_stat_day === undefined || response.SM_stat_day == null ) 
					SM_stat_day = SM_start_day = 0;
				else
					SM_stat_day = SM_start_day = response.SM_stat_day;
//				console.log( "main_stat_day:" + SM_start_day );

				chrome.extension.sendMessage({name: "getOptions"}, function(response) {
					if ( response.SM_enabled === undefined || response.SM_enabled == null || response.SM_enabled == "Disable" ) {
						
						if(SM_node == undefined) {
							SM_node = CreateSM("chrome-ext-scrollmeter", SM_position, SM_start.len, SM_start_day, SM_unit);
							if(SM_node != undefined)
								SM_node.onmouseover = mouseOverFunc;
						}
					}
					// Set mouse handler (main process)
					document.addEventListener("mousewheel", MouseWheelHandler, false);
					loadOptions(); //To set default value on pop-up button
				});
			});
		});
	});
};

var mouseOverFunc = function()
{
	if(this.className == "chrome-ext-scrollmeter-right") {
		this.className = "chrome-ext-scrollmeter-left";
	}
	else {
		this.className = "chrome-ext-scrollmeter-right";
	}
};

//window.onload is override the original
window.addEventListener('load', smInit, false);

chrome.extension.onMessage.addListener(

	function(request, sender, sendResponse)
	{
		switch (request.name)
		{
			case "SM_reload":
//				console.log("SM_reload");
				smInit();
		}
		
	}
);

// popup button clicked
document.addEventListener('DOMContentLoaded', function () {
	getMessage("smPopupMax", "smPopupMax");
	getMessage("smPopupPrevious", "smPopupPrevious");
	var sm = document.getElementById('SM_enabled');
	chrome.extension.sendMessage({name: "getOptions"}, function(response) {
		if(response.SM_enabled != undefined ) {
			if(response.SM_enabled == 'Enable' )
				sm.value = chrome.i18n.getMessage("smPopupEnable") || 'Enable';
			if(response.SM_enabled == 'Disable' )
				sm.value = chrome.i18n.getMessage("smPopupDisable") || 'Disable';
		}
	});
	
	document.getElementById('SM_enabled').addEventListener('click', function() {
		if (sm.value == (chrome.i18n.getMessage("smPopupDisable") || "Disable")) {
			// save to localstore
			chrome.extension.sendMessage({name: "setOptions", status: 'Enable'}, function(response) {});
			sm.value = chrome.i18n.getMessage("smPopupEnable") || "Enable";
			chrome.tabs.getSelected(null, function(tab) {
				var code = 'window.location.reload();';
				chrome.tabs.executeScript(tab.id, {code: code});
			});
		}
		else if (document.getElementById('SM_enabled').value == (chrome.i18n.getMessage("smPopupEnable") || "Enable")) {
			// save to localstore
			chrome.extension.sendMessage({name: "setOptions", status: 'Disable'}, function(response) {});
			sm.value = chrome.i18n.getMessage("smPopupDisable") || "Disable";
			chrome.tabs.getSelected(null, function(tab) {
				var code = 'window.location.reload();';
				chrome.tabs.executeScript(tab.id, {code: code});
			});
		}
	});
	chrome.tabs.getSelected(null, function(tab) {
		var code = 'window.location.hostname;';
		var unit = "m"
		chrome.tabs.executeScript(tab.id, {code: code}, function(result) {
			chrome.extension.sendMessage({name: "getUnit"}, function(response) {
				if ( response.SM_unit !== undefined || response.SM_unit !== null )
					unit = response.SM_unit;
				else
					unit = "m";
				chrome.extension.sendMessage({name: "getStat", site: result[0]}, function(response) {
					if ( response.SM_stat !== undefined || response.SM_stat !== null ) {
						var a = JSON.parse(response.SM_stat);
						if( a.max !== undefined && a.max !== null )
							document.getElementById('SM_max').innerHTML = ConvertUnits(a.max, unit).toFixed(6) + " " + unit;
						else
							document.getElementById('SM_max').innerHTML = "&ndash;";
						if( a.prevlen !== undefined && a.prevlen !== null )
							document.getElementById('SM_prev').innerHTML = ConvertUnits(a.prevlen, unit).toFixed(6) + " " + unit;
						else
							document.getElementById('SM_prev').innerHTML = "&ndash;";
					}
				});
			});
		});
	});
});
