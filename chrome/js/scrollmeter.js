var browser = chrome || browser;
var background; // f or popup only

var SM_position = "right"; // Position of element with counters
var SM_node = null; // Element with counters

var SM_ticks = 23; // Mouse wheel tick counts per revolution
var SM_diameter = SM_ticks; // Mouse wheel diameter
var SM_length = Math.PI * SM_diameter; // mm per length of wheel circle (usually diameter = number of ticks)
var SM_step = SM_length / SM_ticks / 10; // cm per one tick

var SM_unit;
var SM_stat = null; // Statistics
var SM_stat_day = null; // Daily statistics (between inactivity time)

var SM_value = 0;

var SM_alert = false; // Alert popup flag
var SM_listener = false; // Wheel event listener flag

var keys = {37: 1, 38: 1, 39: 1, 40: 1}; // Keycodes for scroll

//browser.extension.getURL("");

//Get and set i18n message for object
function getMessage(id, name) {
    var message = browser.i18n.getMessage(name);
    var elem = document.getElementById(id)
    if (id)
        document.getElementById(id).textContent = message;
}

//Calculates decimals count of n to fit into size count of digits
function FitNumber(n, size) {
    var a = n.toFixed();
    var b = a.length;
    if (size < b)
        return a;
    return n.toFixed(size - b);
}

//convert internal presence (cm) to other units
function ConvertUnits(val, unit) {
    var res;
    switch (unit) {
        case "mi":
            res = val / 100 / 1609.344;
            break;
        case "li":
            res = val / 100 / 500;
            break;
        case "m":
        default:
            res = val / 100;
    }
    return res;
}

//Build the JSON with value (val) started with site (full=true) or day (full=false)
function GetStatJSON(val, full) {
    var domain = window.location.hostname;
    var v = {};
    var vv = {};

    vv["time"] = Date.now();
    vv["len"] = val;
    v[domain] = vv;
    return full ? v : vv;
}

//save statistic to local storage
function SetStat(len) {
    var domain = window.location.hostname;
    var vv = GetStatJSON(len, false);
    var v = JSON.stringify(vv);

    console.debug("SetStat:" + v + ", value:" + len);
    browser.runtime.sendMessage({message: "setStat", site: domain, stat: v}, function(response) {});
}

function preventDefault(e) {
    e = e || window.event;
    if (e.preventDefault)
        e.preventDefault();
    e.returnValue = false;
}

function preventDefaultForScrollKeys(e) {
    if (keys[e.keyCode]) {
        preventDefault(e);
        return false;
    }
}

function disableScroll() {
    if (window.addEventListener) // older FF
        window.addEventListener('DOMMouseScroll', preventDefault, false);
    // WARN: leave the handler for updates
    //document.addEventListener('wheel', preventDefault, {passive: false}); // Disable scrolling in Chrome
    if (window.onwheel)
        window.onwheel = preventDefault; // modern standard
    if (window.onmousewheel)
        window.onmousewheel = document.onmousewheel = preventDefault; // older browsers, IE
    if (window.ontouchmove)
        window.ontouchmove = preventDefault; // mobile
    document.onkeydown = preventDefaultForScrollKeys;
}

function enableScroll() {
    if (window.removeEventListener)
        window.removeEventListener('DOMMouseScroll', preventDefault, false);
    // WARN: leave the handler for updates
    //document.removeEventListener('wheel', preventDefault, {passive: false}); // Enable scrolling in Chrome
    document.addEventListener('wheel', MouseWheelHandler, {capture: false, passive: true});
    if (window.onmousewheel)
        window.onmousewheel = document.onmousewheel = null;
    if (window.onwheel)
        window.onwheel = null;
    if (window.ontouchmove)
        window.ontouchmove = null;
    document.onkeydown = null;
}

//Render current SM element
function BuildSM(par, val, val2, unit) {
    var subdiv = [];
    var t;

    for (i = 0; i < 3; i++) {
        subdiv[i] = document.createElement("DIV");
        subdiv[i].id = par.id + '-v' + i;
        switch (i) {
            case 0:
                t = document.createTextNode(FitNumber(val, 7));
                subdiv[0].appendChild(t);
                break;
            case 1:
                t = document.createTextNode(FitNumber(val2, 7));
                subdiv[1].appendChild(t);
                break;
            case 2:
                t = document.createTextNode(unit);
                subdiv[2].appendChild(t);
        }
        par.appendChild(subdiv[i]);
    }
}

// Delete current SM element
function DeleteSM(el) {
    var b = document.getElementsByTagName('body')[0];
    if (b.id == "SM_popup")
        b = document.getElementsByTagName('body')[1];
    if (b != undefined) {
        var elem = document.getElementById(el);
        if (elem != undefined)
            b.removeChild(elem);
    }
}

// Create and render SM element
function CreateSM(el, position, val, val2, unit) {
    var elem = null;
    var res = ConvertUnits(val, unit);
    var res2 = ConvertUnits(val2, unit);
    var b = document.getElementsByTagName('body')[0];
    if (b.id == "SM_popup")
        b = document.getElementsByTagName('body')[1];
    if (b != undefined) {
        var div = document.createElement("DIV");
        div.id = el;
        div.className = el + '-' + position;
        BuildSM(div, res, res2, unit);
        elem = b.appendChild(div);
    }
    return elem;
}

// Update SM element
function UpdateSM(el, val, val2, unit) {
    var res = ConvertUnits(val, unit);
    var res2 = ConvertUnits(val2, unit);

    //remove the values
    while (el.firstChild)
        el.removeChild(el.firstChild);

    BuildSM(el, res, res2, unit);
}

// Create and render Alert popup
function CreateAlert(el, distance, period, unit) {
    var elem = null;
    var b = document.getElementsByTagName('body')[0];
    if (b.id == "SM_popup")
        b = document.getElementsByTagName('body')[1];
    if (b != undefined) {
        var overlay = document.createElement("DIV");
        overlay.id = el + '-overlay';
        b.insertBefore(overlay, b.firstChild);
        var popup = document.createElement("DIV");
        popup.id = el;
        popup.className = el + '-popup';
        let t = document.createTextNode("You just passed " + distance + " " + unit + ".");
        let t1 = document.createTextNode("Take a break, please!");
        let t2 = document.createTextNode("(" + period + " hr)");
        let div = document.createElement("DIV");
        let div1 = document.createElement("DIV");
        let div2 = document.createElement("DIV");
        div.appendChild(t);
        div1.appendChild(t1);
        div2.appendChild(t2);
        popup.appendChild(div);
        popup.appendChild(div1);
        popup.appendChild(div2);
        elem = b.appendChild(popup);
    }
    b.style.overflow = "hidden";
    disableScroll();
    return elem;
}

// Delete Alert popup
function DeleteAlert(el) {
    var b = document.getElementsByTagName('body')[0];
    if (b.id == "SM_popup")
        b = document.getElementsByTagName('body')[1];
    if (b != undefined) {
        var elem = document.getElementById(el);
        if (elem != undefined)
            b.removeChild(elem);
        elem = document.getElementById(el + '-overlay');
        if (elem != undefined)
            b.removeChild(elem);
    }
    b.style.overflow = "visible";
    enableScroll();
}

// Wheel handler
function MouseWheelHandler(e) {
    e = window.event || e;
    var domain = window.location.hostname;
    SM_listener = true;

    if (SM_alert) {
        browser.runtime.sendMessage({message: "checkInactive", "site": domain}, function(response) {});
        return false;
    }

    // Beware unitialized data
    if (SM_unit == undefined)
        return false;
    if (SM_node == undefined)
        return false;

    var res;
    var delta = Math.max(-1, Math.min(1, (e.wheelDelta || -e.deltaY || -e.detail)));
    var direction = (e.detail < 0 || e.wheelDelta > 0) ? 1 : -1; // Reserved

    browser.runtime.sendMessage({message: "getStat", site: domain}, function(response) {
        if (typeof response == 'undefined' || typeof response.SM_stat == 'undefined' || response.SM_stat == null) {
            SM_stat = GetStatJSON(0,false);
            SM_len_sum = 0.0;
        } else {
            SM_stat = JSON.parse(response.SM_stat);
            SM_len_sum = parseFloat(response.SM_sum);
        }
        console.debug( "getStat: SM_stat=" + JSON.stringify(SM_stat) + ", SM_len_sum=" + SM_len_sum + ", SM_value=" + SM_value);
        SM_value = SM_stat["len"] + Math.abs(delta) * SM_step;
        console.debug("SM_value = " + SM_value);
        browser.runtime.sendMessage({message: "setStat", site: domain, delta: SM_value, time: Date.now()}, function(response) {});
        UpdateSM(SM_node, SM_value, SM_len_sum + (Math.abs(delta) * SM_step), SM_unit);
    });
    return false;
}

// Set position of counters on mouseOver
var mouseOverFunc = function() {
    if (this.className == "chrome-ext-scrollmeter-right") {
        this.className = "chrome-ext-scrollmeter-left";
    } else {
        this.className = "chrome-ext-scrollmeter-right";
    }
};

// Init or reload data
var smInit = function() {
    var domain = window.location.hostname;
    var SM_start = {};
    var SM_start_day = 0;

    SM_value = 0;
    console.debug("Init SM: Alert=" + ((SM_alert)?"true":"false") + ", Listener=" + ((SM_listener)?"true":"false"));
    browser.runtime.sendMessage({message: 'getTicks'}, function(response) {
        if (response.SM_ticks == undefined || response.SM_ticks == null)
            SM_ticks = 23; //default
        else
            SM_ticks = parseInt(response.SM_ticks);
        console.debug("Init ticks: " + SM_ticks);
    });

    browser.runtime.sendMessage({message: 'getDiameter'}, function(response) {
        if (response.SM_diameter === undefined || response.SM_diameter == null)
            SM_diameter = 23; //default
        else
            SM_diameter = parseInt(response.SM_diameter);
        console.debug("Init diameter: " + SM_diameter);
    });

    browser.runtime.sendMessage({message: 'getUnit'}, function(response) {
        if (response.SM_unit === undefined || response.SM_unit == null)
            SM_unit = "m"; //default
        else
            SM_unit = response.SM_unit;
        console.debug("Init unit: " + SM_unit);

        browser.runtime.sendMessage({message: "getStat", site: domain}, function(response) {
            if (response.SM_stat === undefined || response.SM_stat == null) {
                SM_start = SM_stat = GetStatJSON(0, false);
                SM_start_day = SM_stat_day = 0;
            } else {
                SM_start = SM_stat = JSON.parse(response.SM_stat);
                SM_start_day = SM_stat_day = parseFloat(response.SM_sum);
            }
            SM_value = SM_stat.len;
            console.debug("Init start: " + JSON.stringify(SM_start) + ", daily sum: " + SM_start_day);

            browser.runtime.sendMessage({message: "getOptions"}, function(response) {
                if (response.SM_enabled === undefined || response.SM_enabled == null || response.SM_enabled == "Disable") {
                    if (SM_node == undefined) {
                        var b = document.getElementsByTagName('body')[0];
                        if (b.id == "SM_popup")
                            b = document.getElementsByTagName('body')[1];
                        if (b !== undefined) {
                            SM_node = document.getElementById("chrome-ext-scrollmeter");
                            if (SM_node === undefined || SM_node == null) {
                                SM_node = CreateSM("chrome-ext-scrollmeter", SM_position, SM_start.len, SM_start_day, SM_unit);
                                if (SM_node !== undefined)
                                    SM_node.onmouseover = mouseOverFunc;
                            }
                        }
                    } else {
                        UpdateSM(SM_node, SM_value, SM_start_day, SM_unit);
                    }
                }
                //load other options and set default values for pop-up button
                browser.runtime.sendMessage({message: "loadOptions", source: "tab"}, function(response) {});
                // Set mouse handler (main process)
                if (!SM_listener) {
                    console.debug("Init scroll listener");
                    document.addEventListener("wheel", MouseWheelHandler, {capture: false, passive: true});
                    //SM_listener = true;
                }
//                if(SM_alert) {
                    browser.runtime.sendMessage({message: "disableAlert"}, function(response) {
                        SM_alert = false;
                    });
//                }
            });
        });
    });
};

var smUpdate = function() {
    var domain = window.location.hostname;
    browser.runtime.sendMessage({message: "getStat", site: domain}, function(response) {
        if (response.SM_stat === undefined || response.SM_stat == null) {
            SM_start = SM_stat = GetStatJSON(0, false);
            SM_start_day = SM_stat_day = 0;
        } else {
            SM_start = SM_stat = JSON.parse(response.SM_stat);
            SM_start_day = SM_stat_day = parseFloat(response.SM_sum);
        }
        SM_value = SM_stat.len;
        console.debug("Update start: " + JSON.stringify(SM_start) + ", daily sum: " + SM_start_day);

        if(SM_node !== undefined)
            UpdateSM(SM_node, SM_value, SM_start_day, SM_unit);

        let el = document.getElementById('chrome-ext-scrollmeter-alert');

        if (response.SM_alert !== undefined) {
            if ((el === undefined || el == null) && !SM_alert) {
                CreateAlert('chrome-ext-scrollmeter-alert', response.SM_alert.distance, response.SM_alert.period, response.SM_alert.unit);
                SM_alert = true;
            }
        } else {
            if ((el !== undefined && el != null) && SM_alert) {
                DeleteAlert('chrome-ext-scrollmeter-alert');
                SM_alert = false;
            }
        }
    });
}

//window.onload is override the original
window.addEventListener('load', smInit, false);

// popup button clicked
document.addEventListener('DOMContentLoaded', function() {
    getMessage("smPopupMax", "smPopupMax");
    getMessage("smPopupPrevious", "smPopupPrevious");
    var sm = document.getElementById("SM_enabled");
    browser.runtime.sendMessage({message: "getOptions"}, function(response) {
        if (response.SM_enabled != undefined) {
            if (response.SM_enabled == 'Enable')
                sm.value = browser.i18n.getMessage("smPopupEnable") || 'Enable';
            if (response.SM_enabled == 'Disable')
                sm.value = browser.i18n.getMessage("smPopupDisable") || 'Disable';
        }
    });

    document.getElementById('SM_enabled').addEventListener('click', function() {
        if (sm.value == (browser.i18n.getMessage("smPopupDisable") || "Disable")) {
            // save to localstore
            browser.runtime.sendMessage({message: "setOptions", status: 'Enable'}, function(response) {});
            sm.value = browser.i18n.getMessage("smPopupEnable") || "Enable";
            browser.tabs.query({active: true, currentWindow: true}, function(tabs) {
                var code = 'window.location.reload();';
                if (tabs && tabs.length > 0)
                    browser.tabs.executeScript(tabs[0].id, {code: code});
            });
        } else if (document.getElementById('SM_enabled').value == (browser.i18n.getMessage("smPopupEnable") || "Enable")) {
            // save to localstore
            browser.runtime.sendMessage({message: "setOptions", status: 'Disable'}, function(response) {});
            sm.value = browser.i18n.getMessage("smPopupDisable") || "Disable";
            browser.tabs.query({active: true, currentWindow: true}, function(tabs) {
                var code = 'window.location.reload();';
                if (tabs && tabs.length > 0)
                    browser.tabs.executeScript(tabs[0].id, {code: code});
            });
        }
    });
    browser.tabs.query({active: true, currentWindow: true}, function(tabs) {
        var code = 'window.location.hostname;';
        var unit = "m"
        if (tabs && tabs.length > 0) {
            browser.tabs.executeScript(tabs[0].id, {code: code}, function(result) {
                browser.runtime.sendMessage({message: "getUnit"}, function(response) {
                    if (response.SM_unit !== undefined || response.SM_unit !== null)
                        unit = response.SM_unit;
                    else
                        unit = "m";
                    browser.runtime.sendMessage({message: "getStat", site: (result ? result[0] : null)}, function(response) {
                        if (response.SM_stat !== undefined || response.SM_stat !== null) {
                            var a = JSON.parse(response.SM_stat);
                            if (a && a.max !== undefined && a.max !== null)
                                document.getElementById('SM_max').textContent = ConvertUnits(a.max, unit).toFixed(6) + " " + unit;
                            else
                                document.getElementById('SM_max').textContent = "–";
                            if (a && a.prevlen !== undefined && a.prevlen !== null)
                                document.getElementById('SM_prev').textContent = ConvertUnits(a.prevlen, unit).toFixed(6) + " " + unit;
                            else
                                document.getElementById('SM_prev').textContent = "–";
                        }
                    });
                });
            });
        }
    });
});

// Listen background messages
browser.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    //console.debug("Content message: " + request.message);
    switch (request.message) {
        case "SM_update":
            smUpdate();
            sendResponse({confirmation: "Successfully updated"});
            break;
        case "SM_reload":
            SM_alert = false;
            DeleteAlert('chrome-ext-scrollmeter-alert');
            smInit();
            sendResponse({confirmation: "Successfully reloaded"});
            break;
        case "SM_alert":
            if (!SM_alert) {
                CreateAlert('chrome-ext-scrollmeter-alert', request.distance, request.period, request.unit);
                SM_alert = true;
            }
            sendResponse({confirmation: "Successfully alerted"});
            break;
        default:
            //console.debug("SM_message: Unknown request (" + request.message + ")");
    }
});

