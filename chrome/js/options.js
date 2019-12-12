const SM_DIST_MI = 1609.344;
const SM_DIST_LI = 500;
const SM_ALERT = 1

var browser = chrome || browser;

var defaultUnit = "m";
var defaultAlertDistance = 100; //100 meters/miles/li
var defaultInactive = 1; //1 hour
var defaultResetStat = true;
var defaultWheelTicks = 23;
var defaultWheelDiameter = 23;
var checkWheel = 0;

var SM_stat ={};
var SM_unit;
var SM_alertdistance;
var SM_inactive;
var SM_resetstat;
var SM_ticks;
var SM_diameter;
var SM_precision = 0.01;

window.onload = function()
{
	window.addEventListener("load", loadOptions);

	//Units
	document.getElementById("save-button-unit").addEventListener("click",saveUnit);
	document.getElementById("save-button-unit-restore").addEventListener("click",restoreUnit);
	document.getElementById("units").addEventListener("change",changeUnit);

	//<input id="alertdistance" type="number" class="mod" name="alertdistance" placeholder="Input units" min="0" max="1000000" step="0.0001">
	//Alerrt at distance
	document.getElementById("save-button-alertdistance").addEventListener("click",saveAlertDistance);
	document.getElementById("save-button-alertdistance-restore").addEventListener("click",restoreAlertDistance);
	document.getElementById("alertdistance").addEventListener("change",changeAlertDistance);

	//Inactivity period
	document.getElementById("save-button-inactivity").addEventListener("click",saveInactivity);
	document.getElementById("save-button-inactivity-restore").addEventListener("click",restoreInactivity);
	document.getElementById("inactivity").addEventListener("change",changeInactivity);

	//Reset sites statistics on first presence
	document.getElementById("save-button-resetstat").addEventListener("click",resetStat);
	document.getElementById("save-button-resetstat-restore").addEventListener("click",restoreResetStat);
	document.getElementById("resetstat").addEventListener("change",changeResetStat);

	//Data
	document.getElementById("save-button-clean").addEventListener("click",cleanStorage);
	document.getElementById("save-button-clean-opt").addEventListener("click",cleanStorageOpt);

	//Mouse Wheel
	document.getElementById("save-button-wheel").addEventListener("click",saveWheel);
	document.getElementById("save-button-wheel-restore").addEventListener("click",restoreWheel);
	document.getElementById("wheelticks").addEventListener("change",changeWheelTicks);
	document.getElementById("wheeldiameter").addEventListener("change",changeWheelDiameter);
	
	loadOptions();
	loadLocales();
};

function getMessage(id, name) {
	var message = browser.i18n.getMessage(name);
	document.getElementById(id).textContent = message;
}

function GetStep(unit,decimals)
{
	var step;
	switch(unit) {
		case "mi" :
			step = (decimals) ? 3 : 0.0001;
			break;
		case "li" :
			step = (decimals) ? 2 : 0.001;
			break;
		case "m" :
		default:
			step = (decimals) ? 0 : 1;
	}
	return step;
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

//Add zero to values < 10
function AddZero( time )
{
	return (time < 10) ? '0' + time : time;
}

//Converts the timestamp to readable string
function TimeToStr( timestamp, full )
{
	var date = new Date( parseInt(timestamp, 10) );
	
	var ss = AddZero( date.getSeconds() );
	var mm = AddZero( date.getMinutes() );
	var hh = AddZero( date.getHours() );
	var DD = AddZero( date.getDate() );
	var MM = AddZero( date.getMonth()+1 );
	var YYYY = date.getFullYear();
	if(full)
		return YYYY + '.' + MM + '.' + DD + ' ' + hh + ':' + mm + ':' + ss;
	return YYYY + '.' + MM + '.' + DD;
}
// Builds the HTML Table
function addTable(id, obj) {
	var tableDiv = document.getElementById(id);
	tableDiv.border = "1px solid #bcbcbc";
	var table = document.createElement('TABLE');

	var tableHead = document.createElement('THEAD');
	table.appendChild(tableHead);
	var tr = document.createElement('TR');
	tableHead.appendChild(tr);
	for(var h=0;h<4;h++) {
		var th = document.createElement('TH');
		var hrow;
		switch(h) {
			case 0:
				var hrow = browser.i18n.getMessage("smStorageDataSite") || "site";
				break;
			case 1:
				var hrow = browser.i18n.getMessage("smStorageDataDistance") || "dist.";
				break;
			case 2:
				var hrow = browser.i18n.getMessage("smStorageDataMaxDistance") || "max dist.";
				break;
			case 3:
				var hrow = browser.i18n.getMessage("smStorageDataTime") || "time";
		}
		th.appendChild( document.createTextNode(hrow) );
		tr.appendChild( th );
	}
	
	var tableBody = document.createElement('TBODY');
	table.appendChild(tableBody);

	for(var key in obj)
	{
		if(obj.hasOwnProperty(key))
		{
			var objrow = obj[key];
			var tr = document.createElement('TR');
			tableBody.appendChild(tr);
			
			for (var j=0; j<4; j++)
			{
				var td = document.createElement('TD');
				var row;
				switch(j) {
					case 0: //site
						row = key;
						break;
					case 1: //len
						var a = objrow['len'] || 0;
						row = (a>0)?InternalToUnits(a, SM_unit).toFixed(4) : "";
						break;
					case 2: //max
						var a = objrow['max'] || 0;
						row = (a>0)?InternalToUnits(a, SM_unit).toFixed(4) : "";
						break;
					case 3: //maxtime
						var a = objrow['maxtime'] || 0;
						row = (a>0)?TimeToStr(a, false) : "";
				}
				td.appendChild( document.createTextNode(row) );
				tr.appendChild( td );
			}
		}
	}
	tableDiv.appendChild(table);
}

function loadOptions()
{
	var options = 0;
	var data = 0;

	options += ( loadUnit() )? 1:0;
	options += ( loadAlertDistance() )? 1:0;
	options += ( loadInactivity() )? 1:0;
	options += ( loadResetStat() )? 1:0;
	data += ( loadStorage() )? 1:0;
	options += ( loadWheel() )? 1:0;

	//console.debug("opt: " + options + "data: " + data);
	document.getElementById("save-button-clean-opt").disabled = (options)?false:true;
	document.getElementById("save-button-clean").disabled = (data)?false:true;
}

function loadLocales()
{
	getMessage("smSettingsTitle","smSettingsTitle");
	
	//Units
	getMessage("smSettingsUnits","smSettingsUnits");
	getMessage("smSettingsUnitMeter", "smSettingsUnitMeter");
	getMessage("smSettingsUnitMile", "smSettingsUnitMile");
	getMessage("smSettingsUnitLi", "smSettingsUnitLi");
	getMessage("save-button-unit", "smSettingsUnitSave");
	getMessage("save-button-unit-restore", "smSettingsUnitReset");
	
	//Mouse
	getMessage("smSettingsWheelTicks", "smSettingsWheelTicks");
	getMessage("smSettingsWheelDiameter", "smSettingsWheelDiameter");
	getMessage("save-button-wheel", "smSettingsWheelSave");
	getMessage("save-button-wheel-restore", "smSettingsWheelReset");
	
	//Data
	getMessage("smSettingsAlert", "smSettingsAlert");
	getMessage("save-button-alertdistance", "smSettingsAlertSave");
	getMessage("save-button-alertdistance-restore", "smSettingsAlertReset");
	
	getMessage("smSettingsInactivity", "smSettingsInactivity");
	getMessage("save-button-inactivity", "smSettingsInactivitySave");
	getMessage("save-button-inactivity-restore", "smSettingsInactivityReset");
	
	getMessage("smSettingsResetstat", "smSettingsResetstat");
	getMessage("save-button-resetstat", "smSettingsResetstatSave");
	getMessage("save-button-resetstat-restore", "smSettingsResetstatReset");
	
	getMessage("save-button-clean", "smStorageCleanData");
	getMessage("save-button-clean-opt", "smStorageCleanOptions");
	
	getMessage("smSettingsSite", "smSettingsSite");
}

function loadUnit()
{
	var changed = false;
	var unit = localStorage.getItem("SM_unit");
	console.debug("changeUnit: " + unit);
	
	if (unit == undefined || (unit != "m" && unit != "mi" && unit != "li"))
		unit = defaultUnit;
	SM_unit = unit;
	
	if(SM_unit != defaultUnit) {
		changed =  true;
		document.getElementById("save-button-unit").disabled = false;
	}
	else
		document.getElementById("save-button-unit").disabled = true;
	
	var select = document.getElementById("units");

	for (var i = 0; i < select.children.length; i++) {
		var child = select.children[i];

		if (child.value == unit) {
			child.selected = "true";
			break;
		}
	}
	return changed;
}

function saveUnit() {
	var select = document.getElementById("units");
	var unit = select.children[select.selectedIndex].value;
	SM_unit = unit;
	console.debug("saveUnit: " + unit);
	localStorage.setItem("SM_unit", unit);
	browser.runtime.sendMessage({message: "loadOptions", source: "options"}, function(response) {});
	location.reload();
}

function changeUnit() {
	var select = document.getElementById("units");
	var unit = select.children[select.selectedIndex].value;
	console.debug("changeUnit: " + unit);
	if (unit == defaultUnit && SM_unit == defaultUnit)
		document.getElementById("save-button-unit").disabled = true;
	else
		document.getElementById("save-button-unit").disabled = false;
}

function restoreUnit() {
	localStorage.setItem("SM_unit", defaultUnit);
	browser.runtime.sendMessage({message: "loadOptions"}, function(response) {});
	location.reload();
}

function loadAlertDistance()
{
	var changed = false;
	var alertdistance = localStorage.getItem("SM_alertdistance"); //save as unit format
	if (alertdistance == undefined)
		alertdistance = defaultAlertDistance;
	SM_alertdistance = parseFloat( alertdistance );
	console.debug("loadAlertDistance: " + SM_alertdistance + ", default: " +defaultAlertDistance + ", value:" + alertdistance);
	if( alertdistance == defaultAlertDistance )
		document.getElementById("save-button-alertdistance").disabled = true;
	else {
		changed = true;
		document.getElementById("save-button-alertdistance").disabled = false;
	}

	document.getElementById("alertdistance").step = GetStep(SM_unit, false);
	document.getElementById("alertdistance").value = alertdistance;
	return changed;
}

function saveAlertDistance()
{
	var text = document.getElementById("alertdistance").value;
	var alertdistance = text.replace(/,/, '.');
	if ( alertdistance != undefined ) {
		localStorage.setItem("SM_alertdistance", alertdistance);
	}
	console.debug("saveAlertDistance: " + alertdistance );
	browser.runtime.sendMessage({message: "loadOptions", source: "options"}, function(response) {});
	location.reload();
}

function restoreAlertDistance()
{
	localStorage.setItem("SM_alertdistance", defaultAlertDistance);
	browser.runtime.sendMessage({message: "loadOptions", source: "options"}, function(response) {});
	location.reload();
}

function changeAlertDistance()
{
	var input = document.getElementById("alertdistance").value;
	console.debug("changeAlertDistance alertdistance: " + input);
	var a = parseFloat( input.replace(/,/, '.') );
	console.debug("changeAlertDistance: " + a + ", SM_alertdistance: " + SM_alertdistance + ", default: " + defaultAlertDistance + ", precision: " + GetStep(SM_unit,false) );
	if ( a == defaultAlertDistance && SM_alertdistance == defaultAlertDistance ) 
		document.getElementById("save-button-alertdistance").disabled = true;
	else
		document.getElementById("save-button-alertdistance").disabled = false;
}

function loadInactivity()
{
	var changed = false;
	var inactivity = localStorage.getItem("SM_inactive");
	if (inactivity == undefined)
		inactivity = defaultInactive;
	SM_inactive = parseInt( inactivity );
	
	if(inactivity != defaultInactive) {
		changed = true;
		document.getElementById("save-button-inactivity").disabled = false;
	}
	else 
		document.getElementById("save-button-inactivity").disabled = true;
	
	document.getElementById("inactivity").value = inactivity;
	return changed;
}

function saveInactivity() {
	var inactivity_text = document.getElementById("inactivity").value;
	var inactivity = parseInt(inactivity_text);
	if (inactivity != undefined && inactivity > 0)
		localStorage.setItem("SM_inactive", inactivity);
	browser.runtime.sendMessage({message: "loadOptions", source: "options"}, function(response) {});
	location.reload();
}

function changeInactivity() {
	var input = document.getElementById("inactivity").value;
	console.debug("inactivity: " + input);
	if (parseInt( input ) == defaultInactive && SM_inactive == defaultInactive)
		document.getElementById("save-button-inactivity").disabled = true;
	else
		document.getElementById("save-button-inactivity").disabled = false;
}

function restoreInactivity() {
	localStorage.setItem("SM_inactive", defaultInactive);
	browser.runtime.sendMessage({message: "loadOptions", source: "options"}, function(response) {});
	location.reload();
}

function loadResetStat()
{
	var changed = false;
	var resetstat = defaultResetStat;
	var rs = localStorage.getItem("SM_resetstat");
	if (rs != undefined)
		resetstat = parseInt( rs )? true : false;
	else
		resetstat = defaultResetStat;
	console.debug("load resetstat: " + resetstat);
	SM_resetstat = resetstat;
	if(resetstat != defaultResetStat) {
		changed = true;
		document.getElementById("save-button-resetstat").disabled = false;
	}
	else {
		document.getElementById("save-button-resetstat").disabled = true;
	}
	if(resetstat)
		document.getElementById("resetstat").checked = true;
	else
		document.getElementById("resetstat").checked = false;
	return changed;
}

function resetStat() {
	var check = document.getElementById("resetstat").checked;
	console.debug("resetStat: " + check);
	localStorage.setItem( "SM_resetstat", (check)?1:0 );
	browser.runtime.sendMessage({message: "loadOptions", source: "options"}, function(response) {});
	location.reload();
}

function restoreResetStat()
{
	localStorage.setItem( "SM_resetstat", (defaultResetStat)?1:0);
	browser.runtime.sendMessage({message: "loadOptions", source: "options"}, function(response) {});
	location.reload();
}

function changeResetStat()
{
	var check = document.getElementById("resetstat").checked;
	console.debug("resetstat: " + check);
	if (check == defaultResetStat && SM_resetstat == defaultResetStat)
		document.getElementById("save-button-resetstat").disabled = true;
	else
		document.getElementById("save-button-resetstat").disabled = false;
}

function loadStorage()
{
	var changed = false;
	var stat = localStorage.getItem("SM_stat");
	if (stat != undefined) {
		SM_stat = JSON.parse(stat)
		addTable("localstorage", SM_stat);
		changed = true;
	}
	return changed;
}

function cleanStorage() {
	localStorage.removeItem("SM_stat");
	document.getElementById("save-button-clean").disabled = true;
	browser.runtime.sendMessage({message: "loadOptions", source: "options"}, function(response) {});
	location.reload();
}

function cleanStorageOpt() {
	localStorage.removeItem("SM_unit");
	localStorage.removeItem("SM_alertdistance");
	localStorage.removeItem("SM_inactive");
	localStorage.removeItem("SM_resetstat");
	localStorage.removeItem("SM_enabled");
	document.getElementById("save-button-clean-opt").disabled = true;
	browser.runtime.sendMessage({message: "loadOptions", source: "options"}, function(response) {});
	location.reload();
}

function loadWheel()
{
	var changed = false;
	var wheel_ticks = localStorage.getItem("SM_ticks");
	var wheel_diameter = localStorage.getItem("SM_diameter");

	if (wheel_ticks == undefined)
		wheel_ticks = defaultWheelTicks;
	if (wheel_diameter == undefined)
		wheel_diameter = defaultWheelDiameter;
	SM_ticks = wheel_ticks;
	SM_diameter = wheel_diameter;
	if(parseInt(wheel_ticks) != defaultWheelTicks || parseInt( wheel_diameter ) != defaultWheelDiameter) {
		changed = true;
		document.getElementById("save-button-wheel").disabled = false;
		checkWheel = 0;
	}
	else {
		document.getElementById("save-button-wheel").disabled = true;
		checkWheel = 3;
	}
	document.getElementById("wheelticks").value = wheel_ticks;
	document.getElementById("wheeldiameter").value = wheel_diameter;
	return changed;
}

function saveWheel() {
	var wheel_ticks_text = document.getElementById("wheelticks").value;
	var wheel_diameter_text = document.getElementById("wheeldiameter").value;
	var wheel_ticks = parseInt( wheel_ticks_text );
	var wheel_diameter = parseInt( wheel_diameter_text );
	
	if (wheel_ticks != undefined && wheel_ticks > 0)
		localStorage.setItem("SM_ticks", wheel_ticks);
	
	if(wheel_diameter != undefined && wheel_diameter > 0)
		localStorage.setItem("SM_diameter", wheel_diameter);
	browser.runtime.sendMessage({message: "loadOptions", source: "options"}, function(response) {});
	location.reload();
}

function changeWheelTicks()
{
	var input = document.getElementById("wheelticks").value;
	console.debug("wheelticks: " + input + ", check: " + checkWheel);
	
	if (parseInt( input ) == defaultWheelTicks && SM_ticks == defaultWheelTicks)
		checkWheel |= 1;
	else
		checkWheel &= 2;
	
	if(checkWheel == 3)
		document.getElementById("save-button-wheel").disabled = true;
	else
		document.getElementById("save-button-wheel").disabled = false;
}

function changeWheelDiameter()
{
	var input = document.getElementById("wheeldiameter").value;
	console.debug("wheeldiameter: " + input + ", check: " + checkWheel);
	if (parseInt( input ) == defaultWheelDiameter && SM_diameter == defaultWheelDiameter)
		checkWheel |= 2;
	else
		checkWheel &= 1;

	if(checkWheel == 3)
		document.getElementById("save-button-wheel").disabled = true;
	else
		document.getElementById("save-button-wheel").disabled = false;
}

function restoreWheel()
{
	localStorage.setItem("SM_ticks", defaultWheelTicks);
	localStorage.setItem("SM_diameter", defaultWheelDiameter);
	browser.runtime.sendMessage({message: "loadOptions", source: "options"}, function(response) {});
	location.reload();
}
