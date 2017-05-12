!function () {
    if (typeof d3 === 'undefined') { throw new Error('bclib requires d3') }
    if (typeof mqtt === 'undefined') { throw new Error('bclib requires mqtt') }

    d3.selection.prototype.moveToFront = function () {
        return this.each(function () {
            this.parentNode.appendChild(this);
        });
    };

    d3.selection.prototype.moveToBack = function () {
        return this.each(function () {
            var firstChild = this.parentNode.firstChild;
            if (firstChild) {
                this.parentNode.insertBefore(this, firstChild);
            }
        });
    };

    //EventsTopic: locationEngine/event/{teamID}/{siteID}/{mapID}/{eventType}/{deviceMAC}
    //PositionTopic: locationEngine/position/{teamID}/{siteID}/{mapID}/{deviceMAC}
    //RequestTopic: locationEngine/request/bcService/id
    //responseTopic: bcService/response/locationEngine/id
    var LOCATION_ENGINE_NAME = "locationEngine";
    var CLIENT_NAME = "bcService";
    var ENTER_EDGE = "ENTERED_EDGE";
    var EXIT_EDGE = "EXITED_EDGE";
    var ENTER_ZONE = "ENTERED_ZONE";
    var EXIT_ZONE = "EXITED_ZONE";
    var IDENTIFIERS_CHANGED = "DEVICE_IDENTIFIERS_CHANGED";
    var MEASUREMENTS_CHANGED = "MEASUREMENTS_CHANGED";

    var bclib = {};
    bclib.version = "1.0"

    //Util Module
    bclib.util = {};
    bclib.util.adListStr = function (adMask) {
        var ret = "";
        if (adMask & 1) ret += "unk,";
        if (adMask & 2) ret += "iBeac,";
        if (adMask & 4) ret += "eUid,";
        if (adMask & 8) ret += "eUrl,";
        if (adMask & 16) ret += "eTlm,";
        if (adMask & 32) ret += "bcMeas,";
        if (adMask & 64) ret += "bcSec,";
        if (adMask & 128) ret += "bcMan,";
        if (adMask & 256) ret += "bcId,";
        if (adMask & 512) ret += "bcNewB,";
        if (ret)
            ret = ret.substring(0, ret.length - 1);
        return ret;
    };

    bclib.util.iBeaconToDecimal = function (hex) {
        if (!hex)
            return hex;
        var prox = hex.substring(0, hex.length - 8);
        var major = hex.substring(hex.length - 8, hex.length - 4);
        var minor = hex.substring(hex.length - 4);
        return prox + ":" + parseInt(major, 16) + ":" + parseInt(minor, 16);
    };

    bclib.util.guid = function () {
        function s4() {
            return Math.floor((1 + Math.random()) * 0x10000)
              .toString(16)
              .substring(1);
        }
        return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
          s4() + '-' + s4() + s4() + s4();
    };

    //UI Module
    bclib.ui = {};

    bclib.ui.MapEditor = function (selector, mapDto, deviceDtos, searchFunc) {
        var obj = this;
        var selector = selector;
        var mapDto = mapDto;
        var deviceDtos = deviceDtos;
        var searchFunc = searchFunc;
        var eventCallbacks = {};
        var container;
        var outerSVG;
        var svg;
        var mapImage;
        var zoomScale = 1;
        var currentPan = 0;
        var scrollZoom = 1;
        var buttonZoom = 1;
        var zoomInc = 0.3;
        var locked = true;
        var detailsButton;
        var detailsPane;
        var searchSection;
        var searchDisplay;
        var detailsSection;
        var devices = {};
        var offsetX = mapDto.positionX ? mapDto.positionX : 0;
        var offsetY = mapDto.positionY ? mapDto.positionY : 0;
        var deviceSize = 80;
        var selectedSize = 120;
        var selectedDevice = null;

        obj.resetScale = function () {
            scaled = true;
            currentPan = [0, 0];
            svg.attr("transform", "translate(" + currentPan + ")" + " scale(1)");
            var outerBox = outerSVG.node().getBoundingClientRect();
            var innerBox = svg.node().getBoundingClientRect();

            var xScale = outerBox.width / innerBox.width;
            var yScale = outerBox.height / innerBox.height;

            if (isNaN(xScale) || isNaN(yScale))
                zoomScale = 1;
            else if (xScale < yScale)
                zoomScale = xScale;
            else
                zoomScale = yScale;

            svg.attr("transform", "translate(" + currentPan + ")" + " scale(" + zoomScale + ")");

            outerBox = outerSVG.node().getBoundingClientRect();
            innerBox = svg.node().getBoundingClientRect();
            var xPan = (outerBox.width / 2) - (innerBox.width / 2) +  outerBox.left - innerBox.left;
            var yPan = (outerBox.height / 2) - (innerBox.height / 2) +  outerBox.top - innerBox.top;
            currentPan = [ xPan, yPan ];

            scrollZoom = 1;
            buttonZoom = 1;
            svg.attr("transform", "translate(" + currentPan + ")" + " scale(" + zoomScale + ")");
            
            var zoom = d3.behavior.zoom().on("zoom", function() {
                if (!locked) {
                    scrollZoom = d3.event.scale;
                    svg.attr("transform", "translate(" + currentPan + ")" + " scale(" + (scrollZoom * buttonZoom * zoomScale) + ")");
                }
            });
            var drag = d3.behavior.drag().origin(function() { return { x: currentPan[0], y: currentPan[1] } }).on("drag", function() {
                if (!locked) {
                    currentPan = [d3.event.x, d3.event.y];
                    svg.attr("transform", "translate(" + currentPan + ")" + " scale(" + (scrollZoom * buttonZoom * zoomScale) + ")");
                }
            });
            outerSVG.call(zoom);
            outerSVG.call(drag);
        };

        obj.zoomIn = function () {
            buttonZoom = buttonZoom + zoomInc;
            svg.attr("transform", "translate(" + currentPan + ")" + " scale(" + (scrollZoom * buttonZoom * zoomScale) + ")");
        };

        obj.zoomOut = function () {
            buttonZoom = buttonZoom - zoomInc;
            if (buttonZoom < zoomInc)
                buttonZoom = zoomInc;
            svg.attr("transform", "translate(" + currentPan + ")" + " scale(" + (scrollZoom * buttonZoom * zoomScale) + ")");
        };

        obj.lock = function(flag) {
            locked = flag;
        }

        obj.on = function(e, callback) {
            if (typeof callback != 'function') {
                return;
            }
            if(!eventCallbacks[e]) {
                eventCallbacks[e] = [];
            }
            eventCallbacks[e].push(callback);
        };

        init();

        function broadcast(e, obj) {
            if (!eventCallbacks[e])
                return;
            for (var i = 0; i < eventCallbacks[e].length; i++) {
                eventCallbacks[e][i](obj);
            }
        }

        function init() {
            setDevices();
            createUI();
        }

        function createUI() {
            container = d3.select(selector).classed("bcmapeditor", true);
            var header = container.append("div").classed("editor-header", true);

            header.append("button").classed("bcbtn", true).classed("bcbtn-save", true).style("float", "left");

            header.append("button").classed("bcbtn", true).classed("bcbtn-add", true).style("float", "left").on("click", function() {
                selectedDevice = null;
                svg.selectAll(".select-box").remove();
                detailsSection.style("display", "none");
                searchSection.style("display", null);
            });

            header.append("button").classed("bcbtn", true).classed("bcbtn-zoom-in", true).style("float", "right").on("click", function() {
                obj.zoomIn();
            });

            header.append("button").classed("bcbtn", true).classed("bcbtn-zoom-out", true).style("float", "right").on("click", function() {
                obj.zoomOut();
            });

            var lockButton = header.append("button").classed("bcbtn", true).classed("bcbtn-lock", true).style("float", "right").on("click", function() {
                locked = !locked;
                lockButton.classed("bcbtn-lock", false);
                lockButton.classed("bcbtn-unlock", false);
                if (locked)
                    lockButton.classed("bcbtn-lock", true);
                else 
                    lockButton.classed("bcbtn-unlock", true);

                obj.lock(locked);
            });

            header.append("button").classed("bcbtn", true).classed("bcbtn-center", true).style("float", "right").on("click", function() {
                obj.resetScale();
            });

            outerSVG = container
            .append("svg")
            .on("dblclick.zoom", null);

            svg = outerSVG.append("g");

            mapImage = svg.append("image")
                .attr("href", mapDto.mapResource.url)
                .attr("x", 0).attr("y", 0);

            mapImage.node().addEventListener('load', obj.resetScale);

            drawDevices();

            detailsPane = container.append("div").classed("details-pane", true);

            searchSection = detailsPane.append("div").classed("search-section", true).style("display", "none");
            searchSection.append("h2").text("Add To Map");
            var search = searchSection.append("input").attr("type", "text").attr("placeholder", "Search");
            search.node().onkeyup = function () { searchFunc(search.node().value, renderSearchResults) };
            searchDisplay = searchSection.append("div");

            detailsSection = detailsPane.append("div").classed("details-section", true);
            detailsSection.append("h2").text("Device Details");
            detailsSection.append("table").classed("device-details", true).append("tr").append("td")
                .attr("colspan", 2).style("text-align", "center").text("Click on a device to see details");
        }

        function renderSearchResults(sSearch, deviceDtos) {
            searchDisplay.node().innerHTML = ""
            if (!deviceDtos || deviceDtos.devices.length == 0)
                return;
            var devices = deviceDtos.devices;

            for (var i = 0; i < devices.length; i++) {
                var table = searchDisplay.append("table").classed("search-result", true);

                var row = table.append("tr");
                row.append("td").text("Name");
                row.append("td").text(devices[i].name);

                row = table.append("tr");
                row.append("td").text("SN");
                row.append("td").text(devices[i].serialNumber);

                if (devices[i].bluetoothAddress) {
                    row = table.append("tr");
                    row.append("td").text("BT Addr");
                    row.append("td").text(devices[i].bluetoothAddress);
                }
            }
        }

        function setDevices() {
            for (var i = 0; i < deviceDtos.length; i++) {
                if (deviceDtos[i].id && deviceDtos[i].mapPoint && deviceDtos[i].mapPoint.mapID && deviceDtos[i].mapPoint.mapID == mapDto.id &&
                    deviceDtos[i].mapPoint.point && deviceDtos[i].mapPoint.point.x && deviceDtos[i].mapPoint.point.y) {
                    var device = {
                        id: deviceDtos[i].id,
                        x: deviceDtos[i].mapPoint.point.x,
                        y: deviceDtos[i].mapPoint.point.y,
                        name: deviceDtos[i].name,
                        serialNumber: deviceDtos[i].serialNumber,
                        bluetoothAddress: deviceDtos[i].beacon ? deviceDtos[i].beacon.bluetoothAddress : null,
                        imageUrl: deviceDtos[i].wireframeUrl
                    };
                    devices[device.id] = device;
                }
            }
        }

        function drawDevices() {
            svg.selectAll(".device-circ").remove();
            svg.selectAll(".device-img").remove();

            for (var id in devices) {
                var device = devices[id];
                var deviceCirc = svg.append("circle")
                    .attr("cx", device.x + offsetX)
                    .attr("cy", device.y + offsetY)
                    .attr("r", deviceSize / 2)
                    .attr("fill", "white")
                    .attr("class", "device-circ");
                var deviceImg = svg.append("image")
                    .attr("href", device.imageUrl)
                    .attr("x", device.x - (0.5 * deviceSize) + offsetX)
                    .attr("y", device.y - (0.5 * deviceSize) + offsetY)
                    .attr("class", "device-img").attr("width", deviceSize).attr("height", deviceSize);

                (function (deviceImg, id) {
                    deviceImg.node().onclick = function () {
                        selectDevice(id);
                    };
                }(deviceImg, id));
            }
        }

        function selectDevice(id) {
            selectedDevice = devices[id];
            svg.selectAll(".select-box").remove();

            svg.append("polygon").classed("select-box", true).attr("points",
                (selectedDevice.x - (0.5 * selectedSize) + offsetX) + "," + (selectedDevice.y + offsetY) + " " +
                (selectedDevice.x + offsetX) + "," + (selectedDevice.y - (0.5 * selectedSize) + offsetY) + " " +
                (selectedDevice.x + (0.5 * selectedSize) + offsetX) + "," + (selectedDevice.y + offsetY) + " " +
                (selectedDevice.x + offsetX) + "," + (selectedDevice.y + (0.5 * selectedSize) + offsetY)
            );

            searchSection.style("display", "none");
            detailsSection.style("display", null);

            detailsSection.selectAll(".device-details").remove();
            var table = detailsSection.append("table").classed("device-details", true);

            var row = table.append("tr");
            row.append("td").text("Name");
            row.append("td").text(devices[id].name);

            row = table.append("tr");
            row.append("td").text("SN");
            row.append("td").text(devices[id].serialNumber);

            if (devices[id].bluetoothAddress) {
                row = table.append("tr");
                row.append("td").text("BT Addr");
                row.append("td").text(devices[id].bluetoothAddress);
            }
        }

    }

    //BoundTable Object, Public: addRow, removeRow, updateRow
    bclib.ui.BoundTable = function (selector, headers, tableClass, bSearch) {
        d3.select(selector).node().innerHtml = "";
        var obj = this;
        var selector = selector;
        var headers = headers;
        var tableClass = tableClass;
        var bSearch = bSearch;
        var count = 0;
        var data = {};
        var search = null;
        var renderTime = 100;

        var outerContainer = d3.select(selector).style("padding", "15px");

        if (bSearch) {
            search = outerContainer.append("input").attr("type", "text").attr("placeholder", "Search").attr("class", "boundtable-search");
            search.node().onkeyup = function () { render() };
        }

        var container = outerContainer.append("div").style("width", "100%").style("overflow", "auto");
        var table = container.append("table");
        if (tableClass)
            table.attr("class", tableClass);
        var head = table.append("thead").append("tr");
        for (var i = 0; i < headers.length; i++) {
            head.append("th").text(headers[i]);
        }
        var body = table.append("tbody");

        obj.addRow = function (rowData) {
            var index = count++;
            data[index] = rowData;
            return index;
        };

        obj.removeRow = function (id) {
            delete data[id];
        }

        obj.updateRow = function (id, rowData) {
            data[id] = rowData;
        }

        start();

        function render() {
            var tData = data;

            if (bSearch && search.node().value && search.node().value.length > 0) {
                var tData = {};

                for (var key in data) {
                    var rowData = data[key];
                    var match = false;
                    for (var i = 0; i < rowData.length; i++) {
                        var cell = rowData[i];
                        if (cell && typeof cell === 'string' && cell.toUpperCase().includes(search.node().value.toUpperCase()))
                            match = true;
                    }
                    if (match)
                        tData[key] = rowData;
                }
            }

            var rows = body.selectAll("tr").data(d3.keys(tData));

            //update
            var currentCells = rows.selectAll("td").data(function (d, i) { return tData[d]; });
            currentCells.append(function (d) {
                var td = d3.select(this);
                //TODO: implement non-string cases
                if (d && typeof d === 'string' && d.length > 0) {
                    td.selectAll("*").remove();
                    td.text(d);
                }
                return td.node().firstChild;
            });

            //enter
            var newRow = rows.enter().append("tr");
            var cells = newRow.selectAll("td").data(function (d, i) { return tData[d]; });
            cells.enter().append(function (d) {
                var td = d3.select(document.createElement("td"));
                //TODO: implement non-string cases
                if (d && typeof d === 'string' && d.length > 0)
                    td.text(d);
                else
                    td.append("span");
                return td.node();
            });

            //exit
            rows.exit().remove();
        }

        function start() {
            setInterval(function () {
                render();
            }, renderTime);
        }
    };

    //Edge Module
    bclib.edge = {};
    //LiveTable Object
    bclib.edge.LiveTable = function (selector, ip) {
        d3.select(selector).node().innerHtml = "";

        var selector = selector;
        var ip = ip;
        var connected = false;
        var ibeacLookup = {};
        var eddyLookup = {};
        var btLookup = {};
        var macLookup = {};
        var table = null;
        var mqttClient = null;

        if (!ip) {
            errorMsg('Invalid ip');
            return;
        }
        mqttClient = mqtt.connect("ws://" + ip + ":1884");

        mqttClient.on('connect', function () {
            connected = true;
            init();
        });
        setTimeout(function () {
            if (!connected)
                errorMsg('Failed to connect to edge at ' + ip + ':1884');
        }, 1000);


        function init() {
            table = new bclib.ui.BoundTable(
                selector,
                ["MAC", "Ads", "RSSI", "RSSIS", "iBeacon", "Eddystone UID", "BC ID", "BT Address", "accX", "accY", "accZ", "Temperature"],
                "bclivetable",
                true
            );
            
            mqttClient.subscribe("bcAppCore/json/device/mac/+");
            mqttClient.on('message', function (topic, message) {
                try { var deviceJSON = JSON.parse(message) } catch (err) { return; }
                update(deviceJSON);
            });
        }

        function update(json) {
            if (!json.iBeac && !json.eddyUID && !json.btAddr)
                return;

            var id = lookupBeacon(json);
            if (id)
                table.updateRow(id, parseRowData(json));
            else {
                var id = table.addRow(parseRowData(json));
                addToLookup(id, json);
            }
        }

        function lookupBeacon(json) {

            if (json.iBeac && ibeacLookup[json.iBeac])
                return ibeacLookup[json.iBeac];

            if (json.eddyUID && eddyLookup[json.eddyUID])
                return eddyLookup[json.eddyUID];

            if (json.btAddr && btLookup[json.btAddr])
                return btLookup[json.btAddr];

            if (json.mac && macLookup[json.mac])
                return macLookup[json.mac];

            return null;
        }

        function addToLookup(id, json) {
            if (json.iBeac)
                ibeacLookup[json.iBeac] = id;
            if (json.eddyUID)
                eddyLookup[json.eddUID] = id;
            if (json.btAddr)
                btLookup[json.btAddr] = id;
            if (json.mac)
                macLookup[json.mac] = id;
        }

        function parseRowData(json) {
            return [json.mac, bclib.util.adListStr(json.adMsk), json.rssi, json.rssiSmooth, bclib.util.iBeaconToDecimal(json.iBeac), json.eddyUID, json.bcId, json.btAddr, json.accX, json.accY, json.accZ, json.temp ];
        }

        function errorMsg(msg) {
            d3.select(selector).append("div").style("text-align", "center").text(msg);
        }
    };

    //Location Engine Module
    bclib.locationEngine = {};

    bclib.locationEngine.request = function (mqttClient, command, content, responseCallback) {
        var id = bclib.util.guid();
        var requestTopic = LOCATION_ENGINE_NAME + '/request/' + CLIENT_NAME + '/' + id;
        var responseTopic = CLIENT_NAME + "/response/" + LOCATION_ENGINE_NAME + "/" + id;

        if (responseCallback) {
            var msgHandler = function (topic, message) {
                if (!bclib.locationEngine.matchTopics(topic, responseTopic))
                    return;

                try { var json = JSON.parse(message) } catch (err) { var json = null; }
                responseCallback(json);
                mqttClient.unsubscribe(responseTopic);
                mqttClient.removeListener("message", msgHandler);
            };
            mqttClient.subscribe(responseTopic);
            mqttClient.on("message", msgHandler);
        }

        mqttClient.publish(requestTopic, JSON.stringify({
            type: command,
            content: content
        }));
    };

    bclib.locationEngine.matchTopics = function (fullTopic, wildTopic) {
        var wildArr = wildTopic.split("/");
        var fullArr = fullTopic.split("/");
        for (var i = 0; i < wildArr.length; i++) {
            if (wildArr[i] == "#")
                return true;
            if (wildArr[i] != "+" && wildArr[i] != fullArr[i])
                return false;
        }
        return true;
    };

    bclib.locationEngine.configPublish = function (ip, successCallback, failureCallback) {
        var connected = false;
        if (!ip)
            failureCallback('Location engine ip not found');
        var mqttClient = mqtt.connect("ws://" + ip + ":1884");

        mqttClient.on('connect', function () {
            connected = true;
            successCallback('Location engine at ' + ip + ':1884 is updating config');

            bclib.locationEngine.request(mqttClient, "UPDATE_CONFIG", "latest", function (msg) {
                if (msg && msg.status == 1)
                    successCallback('Location engine at ' + ip + ':1884 successfully updated config');
                else
                    failureCallback('Location engine at ' + ip + ':1884 failed to update config');
            });
        });
        setTimeout(function () {
            if (!connected)
                failureCallback('Failed to connect to location engine at ' + ip + ':1884');
        }, 1000);
    };

    bclib.locationEngine.getHealth = function (options) {
        var connected = false;
        var mqttClient = mqtt.connect("ws://" + options.ip + ":1884");

        mqttClient.on('connect', function () {
            connected = true;
            bclib.locationEngine.request(mqttClient, "GET_HEALTH_REPORT", "SYSTEM", function (msg) {
                if (msg && msg.status == 1)
                    options.success(msg.content);
                else
                    options.error('Location engine at ' + options.ip + ':1884 failed to get health report');
            });
        });
        setTimeout(function () {
            if (!connected)
                options.error('Failed to connect to location engine at ' + options.ip + ':1884');
        }, 1000);
    };

    bclib.locationEngine.Core = function (ip, siteID) {
        var obj = this;

        var ip = ip;
        var siteID = siteID;
        var mqttClient = null;
        var eventCallbacks = {};
        var connected = false;
        var eventsTopic = 'locationEngine/event/+/' + siteID + '/+/+/+';
        var devices = {};
        var maps = {};
        var beacons = {};
        var filtered = false;
        var trackedMacs = [];

        obj.beacons = beacons;
        obj.devices = devices;
        obj.trackedMacs = trackedMacs;

        obj.start = function () {
            init();
        }

        obj.getMapIds = function() {
            var ids = [];
            for (var key in maps) {
                ids.push(key);
            }
            return ids;
        };

        obj.getMapInfo = function(id) {
            if (!maps[id])
                return null;
            var mapDevices = {};
            for (var key in maps[id].devices) {
                mapDevices[key] = {
                    x: devices[key].x,
                    y: devices[key].y,
                    name: devices[key].name,
                    mac: devices[key].mac
                };
            }
            return {
                id: id,
                name: maps[id].name,
                url: maps[id].url,
                height: maps[id].height,
                width: maps[id].width,
                offsetX: maps[id].offsetX,
                offsetY: maps[id].offsetY,
                devices: mapDevices
            };
        };

        obj.getMapName = function(id) {
            if (!maps[id])
                return null;
            return maps[id].name;
        };

        obj.getBeaconCount = function(edgeMac) {
            if (typeof devices[edgeMac] == 'undefined' || typeof devices[edgeMac].beacons == 'undefined')
                return 0;
            var beacs = Object.keys(devices[edgeMac].beacons);
            if (filtered)
                return beacs.filter(function(b) { return beacons[b].tracked }).length;
            else
                return beacs.length;
        };

        obj.getAutoIdentifier = function(mac) {
            if (!beacons[mac])
                return mac;

            var beacon = beacons[mac];
            if (beacon.bcIdentifier)
                return beacon.bcIdentifier;

             if (beacon.bluetoothAddress)
                return beacon.bluetoothAddress;

            if (beacon.iBeacon)
                return bclib.util.iBeaconToDecimal(beacon.iBeacon);

            if (beacon.eddystoneUID)
                return beacon.eddystoneUID;

            return mac;
        };

        obj.searchBeacons = function(sSearch) {
            var macs = [];
            if (!sSearch)
                return macs;
            var sSearch = sSearch.toUpperCase();
            for (key in beacons) {
                var beacon = beacons[key];
                var match = false;

                if (beacon.mac != null && beacon.mac.toUpperCase().includes(sSearch))
                    match = true;

                if (!match && beacon.bcIdentifier != null && beacon.bcIdentifier.toUpperCase().includes(sSearch))
                    match = true;

                if (!match && beacon.iBeacon != null && beacon.iBeacon.toUpperCase().includes(sSearch))
                    match = true;

                var iBeaconDec = bclib.util.iBeaconToDecimal(beacon.iBeacon);
                if (!match && beacon.iBeacon != null && iBeaconDec.toUpperCase().includes(sSearch))
                    match = true;

                if (!match && beacon.eddystoneUID != null && beacon.eddystoneUID.toUpperCase().includes(sSearch))
                    match = true;

                if (!match && beacon.bluetoothAddress != null && beacon.bluetoothAddress.toUpperCase().includes(sSearch))
                    match = true;

                if (match)
                    macs.push(key);
            }

            return macs;
        };

        obj.addBeaconToTracking = function(mac) {
            if (mac == null || !beacons[mac])
                return;
            
            if (!beacons[mac].tracked) {
                beacons[mac].tracked = true;
                trackedMacs.push(mac);
            }
        };

        obj.removeBeaconFromTracking = function(mac) {
            if (mac == null || !beacons[mac])
                return;
            
            if (beacons[mac].tracked) {
                beacons[mac].tracked = false;
                trackedMacs.splice(trackedMacs.indexOf(mac), 1);
            }
        };

        obj.clearTrackedBeacons = function() {
            for (key in beacons) {
                beacons[key].tracked = false;
            }
            trackedMacs = [];
            obj.trackedMacs = trackedMacs;
        }

        obj.filter = function(flag) {
            filtered = flag;
        };

        obj.isFiltered = function() {
            return filtered;
        };

        obj.isTracked = function(mac) {
            if (typeof beacons[mac] == 'undefined' || beacons[mac] == null)
                return false;
            return beacons[mac].tracked;
        }

        //connect_success
        //connect_failure
        //setup_success
        //setup_failure
        //invalid_location_update msgJSON
        //location_update eventType
        obj.on = function(e, callback) {
            if (typeof callback != 'function') {
                return;
            }
            if(!eventCallbacks[e]) {
                eventCallbacks[e] = [];
            }
            eventCallbacks[e].push(callback);
        };

        function broadcast(e, obj) {
            if (!eventCallbacks[e])
                return;
            for (var i = 0; i < eventCallbacks[e].length; i++) {
                eventCallbacks[e][i](obj);
            }
        }

        function init() {
            var success = true;
            var mapResponse;
            var deviceResponse;
            connect(function() {
                bclib.locationEngine.request(mqttClient, "GET_MAP_INFO", null, function(json) {
                    mapResponse = json;
                    bclib.locationEngine.request(mqttClient, "GET_DEVICE_INFO", null, function(json) {
                        deviceResponse = json;
                        if (mapResponse.status == 0 || deviceResponse.status == 0 || 
                            !setMapsAndDevices(mapResponse.content.maps, deviceResponse.content.devices))
                            broadcast("setup_failure");
                        else {
                            broadcast("setup_success");
                            initHandler();
                            bclib.locationEngine.request(mqttClient, "DISCOVER_EVENTS", null, null);
                        }
                    });
                });
            });
        }

        function setMapsAndDevices(mapInfo, deviceList) {
            devices = {};
            maps = {};
            obj.devices = devices;

            for (var i = 0; i < mapInfo.length; i++) {
                if (mapInfo[i].id && mapInfo[i].mapResource && mapInfo[i].mapResource.url && 
                    mapInfo[i].mapResource.width && mapInfo[i].mapResource.height && typeof mapInfo[i].name != 'undefined') {

                    if (!maps[mapInfo[i].id])
                        maps[mapInfo[i].id] = { id: mapInfo[i].id, devices: {} }; 

                    maps[mapInfo[i].id].name = mapInfo[i].name;
                    maps[mapInfo[i].id].url = mapInfo[i].mapResource.url;
                    maps[mapInfo[i].id].width = mapInfo[i].mapResource.width;
                    maps[mapInfo[i].id].height = mapInfo[i].mapResource.height;
                    maps[mapInfo[i].id].offsetX = mapInfo[i].positionX ? mapInfo[i].positionX : 0;
                    maps[mapInfo[i].id].offsetY = mapInfo[i].positionY ? mapInfo[i].positionY : 0;
                }
            }
            if (Object.keys(maps).length == 0)
                return false;

            for (var i = 0; i < deviceList.length; i++) {
                if (deviceList[i].mapPoint && deviceList[i].mapPoint.mapID && deviceList[i].mapPoint.point && 
                    deviceList[i].mapPoint.point.x && deviceList[i].mapPoint.point.y && deviceList[i].macAddress) {
                    var device = {
                        mapID: deviceList[i].mapPoint.mapID,
                        x: deviceList[i].mapPoint.point.x,
                        y: deviceList[i].mapPoint.point.y,
                        name: deviceList[i].name ? deviceList[i].name : deviceList[i].macAddress,
                        mac: deviceList[i].macAddress,
                        beacons: {}
                    };
                    if (!(typeof maps[device.mapID] == 'undefined')) {
                        devices[device.mac] = device;
                        maps[device.mapID].devices[device.mac] = device;
                    }
                }
            }

            return true;
        };

        function connect(callback) {
            if (!ip) {
                broadcast("connect_failure");
                return;
            }
            mqttClient = mqtt.connect("ws://" + ip + ":1884");
            mqttClient.on('connect', function () {
                connected = true;
                broadcast("connect_success");
                callback();
            });
            setTimeout(function () {
                if (!connected)
                    broadcast("connect_failure");
            }, 1000);
        }

        function initHandler() {
            mqttClient.subscribe(eventsTopic);
            mqttClient.on('message', function (topic, message) {
                try { var json = JSON.parse(message) } catch (err) { return; }
                if (bclib.locationEngine.matchTopics(topic, eventsTopic)) {
                    if (!validateLocationUpdate(json)) {
                        broadcast("invalid_location_update", json);
                        return;
                    }
                    locationUpdate(json);
                }
            });
        }

        function validateLocationUpdate(msg) {
            if (!msg.event)
                return false;
            if (!msg.event.type)
                return false;
            if (!msg.device)
                return false;
            if (!msg.device.mac)
                return false;
            if ((msg.event.type == ENTER_EDGE || msg.event.type == EXIT_EDGE) && !msg.edgeMAC)
                return false;
            if ((msg.event.type == ENTER_ZONE || msg.event.type == EXIT_ZONE) && (!msg.event.zoneID || !msg.event.zoneName))
                return false;
            return true;
        }

        function locationUpdate(msg) {

            var type = msg.event.type;
            var oldEdgeMac = null;

            //parse beacon info from msg
            var beacon = {
                mac: msg.device.mac,
                edgeMAC: msg.edgeMAC,
                iBeacon: msg.device.iBeacon ? msg.device.iBeacon : null,
                eddystoneUID: msg.device.eddystoneUID ? msg.device.eddystoneUID : null,
                bcIdentifier: typeof(msg.device.bcIdentifier) != 'undefined' ? msg.device.bcIdentifier : null,
                bluetoothAddress: msg.device.bluetoothAddress ? msg.device.bluetoothAddress : null,
                dwellTime: msg.event.dwellTime ? msg.event.dwellTime : 0,
                temperature: typeof(msg.device.temperature) != 'undefined' ? msg.device.temperature : null,
                tiltX: typeof(msg.device.tiltX) != 'undefined' ? msg.device.tiltX : null,
                tiltY: typeof(msg.device.tiltY) != 'undefined' ? msg.device.tiltY : null,
                tiltZ: typeof(msg.device.tiltZ) != 'undefined' ? msg.device.tiltZ : null,
                batteryLevel: typeof(msg.device.batteryLevel) != 'undefined' ? msg.device.batteryLevel : null,
                tracked: false
            };

            //update cache
            if (typeof beacons[beacon.mac] == 'undefined') {

                beacons[beacon.mac] = beacon;
                beacons[beacon.mac].dwellTime = null;
                beacons[beacon.mac].zoneDwellTime = null;
                beacons[beacon.mac].dwellInterval = null;
                beacons[beacon.mac].zoneDwellInterval = null;

                if (typeof devices[beacon.edgeMAC] != 'undefined' && type == ENTER_EDGE)
                    devices[beacon.edgeMAC].beacons[beacon.mac] = beacon;
                else if (type == EXIT_EDGE)
                    beacons[beacon.mac].edgeMAC = null;
            }

            else {
                var savedBeacon = beacons[beacon.mac];

                if (typeof devices[beacon.edgeMAC] != 'undefined' && (type == ENTER_EDGE || type == EXIT_EDGE) && savedBeacon.edgeMAC != null) {
                    oldEdgeMac = savedBeacon.edgeMAC;
                    delete devices[oldEdgeMac].beacons[beacon.mac];
                }

                if (typeof devices[beacon.edgeMAC] != 'undefined' && type == ENTER_EDGE) {
                    devices[beacon.edgeMAC].beacons[beacon.mac] = savedBeacon;
                }

                savedBeacon.edgeMAC = beacon.edgeMAC;

                if (beacon.iBeacon)
                    savedBeacon.iBeacon = beacon.iBeacon;

                if (beacon.eddystoneUID)
                    savedBeacon.eddystoneUID = beacon.eddystoneUID;

                if (beacon.bcIdentifier != null)
                    savedBeacon.bcIdentifier = beacon.bcIdentifier;

                if (beacon.bluetoothAddress)
                    savedBeacon.bluetoothAddress = beacon.bluetoothAddress;

                if (type == ENTER_EDGE || type == EXIT_EDGE)
                    clearInterval(savedBeacon.dwellInterval);

                if (type == ENTER_ZONE || type == EXIT_ZONE)
                    clearInterval(savedBeacon.zoneDwellInterval);

                if (beacon.temperature != null)
                    savedBeacon.temperature = beacon.temperature;
                if (beacon.tiltX != null)
                    savedBeacon.tiltX = beacon.tiltX;
                if (beacon.tiltY != null)
                    savedBeacon.tiltY = beacon.tiltY;
                if (beacon.tiltZ != null)
                    savedBeacon.tiltZ = beacon.tiltZ;
                if (beacon.batteryLevel != null)
                    savedBeacon.batteryLevel = beacon.batteryLevel;
            }

            var savedBeacon = beacons[beacon.mac];

            if (type == ENTER_EDGE || type == EXIT_EDGE) {
                savedBeacon.dwellTime = beacon.dwellTime;
                savedBeacon.dwellInterval =
                    setInterval(function () {
                        savedBeacon.dwellTime += 1;
                    }, 1000);
            }

            if (type == ENTER_ZONE || type == EXIT_ZONE) {
                savedBeacon.zoneDwellTime = beacon.dwellTime;
                savedBeacon.zoneDwellInterval =
                    setInterval(function () {
                        savedBeacon.zoneDwellTime += 1;
                    }, 1000);
            }

            if (type == EXIT_ZONE && savedBeacon.currentZone && msg.event.zoneID == savedBeacon.currentZone.id) {
                savedBeacon.prevZone = { id: msg.event.zoneID, name: msg.event.zoneName }
                savedBeacon.currentZone = null;
            }

            if (type == ENTER_ZONE) {
                if (savedBeacon.currentZone && savedBeacon.currentZone.id != msg.event.zoneID)
                    savedBeacon.prevZone = savedBeacon.currentZone;
                else if (savedBeacon.prevZone && savedBeacon.prevZone.id == msg.event.zoneID)
                    savedBeacon.prevZone = null;
                savedBeacon.currentZone = { id: msg.event.zoneID, name: msg.event.zoneName };
            }

            broadcast("location_update", msg);
        }
    };

    bclib.locationEngine.Map = function(selector, core, id) {
        var obj = this;
        var selector = selector;
        var core = core;
        var id = id;
        var eventCallbacks = {};
        var container;
        var outerSVG;
        var svg;
        var mapImage;
        var mapInfo = core.getMapInfo(id);
        var padding = 40;
        var deviceSize = 50;
        var zoomScale = 1;
        var panmodx = 0;
        var panmody = 0;
        var currentPan = [0, 0];
        var scrollZoom = 1;
        var buttonZoom = 1;
        var zoomInc = 0.3;
        var locked = true;
        var devices;
        var offsetX;
        var offsetY;
        var renderTime = 100;

        obj.resetScale = function () {
            scaled = true;
            currentPan = [0, 0];
            svg.attr("transform", "translate(" + currentPan + ")" + " scale(1)");
            var outerBox = outerSVG.node().getBoundingClientRect();
            var innerBox = svg.node().getBoundingClientRect();

            var xScale = outerBox.width / innerBox.width;
            var yScale = outerBox.height / innerBox.height;

            if (isNaN(xScale) || isNaN(yScale))
                zoomScale = 1;
            else if (xScale < yScale)
                zoomScale = xScale;
            else
                zoomScale = yScale;

            svg.attr("transform", "translate(" + currentPan + ")" + " scale(" + zoomScale + ")");

            outerBox = outerSVG.node().getBoundingClientRect();
            innerBox = svg.node().getBoundingClientRect();
            var xPan = (outerBox.width / 2) - (innerBox.width / 2) +  outerBox.left - innerBox.left;
            var yPan = (outerBox.height / 2) - (innerBox.height / 2) +  outerBox.top - innerBox.top;
            currentPan = [ xPan, yPan ];

            scrollZoom = 1;
            buttonZoom = 1;
            svg.attr("transform", "translate(" + currentPan + ")" + " scale(" + zoomScale + ")");
            
            var zoom = d3.behavior.zoom().on("zoom", function() {
                if (!locked) {
                    scrollZoom = d3.event.scale;
                    svg.attr("transform", "translate(" + currentPan + ")" + " scale(" + (scrollZoom * buttonZoom * zoomScale) + ")");
                }
            });
            var drag = d3.behavior.drag().origin(function() { return { x: currentPan[0], y: currentPan[1] } }).on("drag", function() {
                if (!locked) {
                    currentPan = [d3.event.x, d3.event.y];
                    svg.attr("transform", "translate(" + currentPan + ")" + " scale(" + (scrollZoom * buttonZoom * zoomScale) + ")");
                }
            });
            outerSVG.call(zoom);
            outerSVG.call(drag);
        };

        obj.zoomIn = function () {
            buttonZoom = buttonZoom + zoomInc;
            svg.attr("transform", "translate(" + currentPan + ")" + " scale(" + (scrollZoom * buttonZoom * zoomScale) + ")");
        };

        obj.zoomOut = function () {
            buttonZoom = buttonZoom - zoomInc;
            if (buttonZoom < zoomInc)
                buttonZoom = zoomInc;
            svg.attr("transform", "translate(" + currentPan + ")" + " scale(" + (scrollZoom * buttonZoom * zoomScale) + ")");
        };

        obj.lock = function(flag) {
            locked = flag;
        }

        //device_click mac
        obj.on = function(e, callback) {
            if (typeof callback != 'function') {
                return;
            }
            if(!eventCallbacks[e]) {
                eventCallbacks[e] = [];
            }
            eventCallbacks[e].push(callback);
        };

        init();

        function broadcast(e, obj) {
            if (!eventCallbacks[e])
                return;
            for (var i = 0; i < eventCallbacks[e].length; i++) {
                eventCallbacks[e][i](obj);
            }
        }

        function init() {
            createUI();
            setInterval(function () {
                renderCounts();
            }, renderTime);
        }

        function createUI() {
            container = d3.select(selector).classed("bclivemap", true);
            outerSVG = container
            .append("svg")
            .attr("width", "100%")
            .attr("height", "100%")
            .on("dblclick.zoom", null);

            svg = outerSVG.append("g");

            mapImage = svg.append("image")
                .attr("href", mapInfo.url)
                .attr("x", 0).attr("y", 0);

            mapImage.node().addEventListener('load', obj.resetScale);

            drawDevices();
            drawLabels();
        }

        function drawDevices() {
            svg.selectAll(".device").remove();
            var mapInfo = core.getMapInfo(id);
            devices = mapInfo.devices;
            offsetX = mapInfo.offsetX;
            offsetY = mapInfo.offsetY;

            for (var key in devices) {
                var device = devices[key];
                var devicePic = svg.append("rect")
                .attr("x", device.x - (0.5 * deviceSize) + offsetX)
                .attr("y", device.y - (0.5 * deviceSize) + offsetY)
                .attr("class", "device").attr("width", deviceSize).attr("height", deviceSize);

                (function (devicePic, key) {
                    devicePic.node().onclick = function () {
                        broadcast("device_click", key);
                    };
                }(devicePic, key));
            }
        }

        function drawLabels () {

            for (var key in devices) {
                var device = devices[key];

                var text = svg.append("text")
                    .attr("x", device.x + offsetX).attr("y", device.y + (0.5 * deviceSize) + 45 + offsetY)
                    .attr("text-anchor", "middle")
                    .attr("class", "device-label-text")
                    .text(device.name);

                var width = text.node().getBBox().width;
                var height = text.node().getBBox().height;
                svg.append("rect").attr("x", device.x - (width / 2.0) + offsetX - 10)
                    .attr("y", device.y + (0.5 * deviceSize) + 20 + offsetY - 10)
                    .attr("class", "device-label").attr("width", width + 20).attr("height", height + 20);

                text.moveToFront();
            }
        }

        function renderCounts() {

            for (var mac in devices) {
                var device = devices[mac];

                svg.select("#device_circ_" + device.mac).remove();
                svg.select("#device_count_" + device.mac).remove();

                var count = core.getBeaconCount(device.mac);
                if (count != 0) {
                    var x = device.x - (0.3 * deviceSize) + offsetX;
                    var y = device.y + (0.3 * deviceSize) + offsetY;

                    svg.append("circle")
                        .attr("id", "device_circ_" + device.mac).attr("class", "device-circ")
                        .attr("cx", x).attr("cy", y).attr("r", deviceSize / 2.0);
                    svg.append("text")
                        .attr("id", "device_count_" + device.mac).attr("class", "device-count")
                        .attr("x", x).attr("y", y).attr("text-anchor", "middle").attr("dy", "0.3em")
                        .text(count);
                }
            }
        }
    };

    bclib.locationEngine.EdgePane = function(selector, mac, name, core) {
        var obj = this;

        var selector = selector;
        var mac = mac;
        var name = name;
        var core = core;
        var active = false;
        var pane;
        var eventCallbacks = {};
        var detailsPanel;
        var beaconsPanel;
        var messagesPanel;
        var detailsTab;
        var beaconsTab;
        var messagesTab;
        var noBeaconsText;
        var beaconTable;
        var beaconBody;
        var noMsgText;
        var msgTable;
        var msgBody;
        var msgs = [];
        var msgQLength = 5;
        var renderTime = 100;

        obj.open = function() {
            if (!active)
                broadcast("opened");
            active = true;
            pane.style("display", null);
        };

        obj.close = function() {
            if (active)
                broadcast("closed");
            pane.style("display", "none");
            active = false;
        };

        //opened
        //closed
        obj.on = function(e, callback) {
            if (typeof callback != 'function') {
                return;
            }
            if(!eventCallbacks[e]) {
                eventCallbacks[e] = [];
            }
            eventCallbacks[e].push(callback);
        };

        init();

        function broadcast(e, obj) {
            if (!eventCallbacks[e])
                return;
            for (var i = 0; i < eventCallbacks[e].length; i++) {
                eventCallbacks[e][i](obj);
            }
        }

        function init() {
            createUI();
            setInterval(function () {
                if (active) {
                    updateBeacons();
                    renderMsgs();
                }
            }, renderTime);

            core.on("location_update", function(msg) {
                if ((msg.event.type == ENTER_EDGE || msg.event.type == EXIT_EDGE) && msg.edgeMAC == mac)
                    addMsg(msg);
            });
        }

        function createUI() {
            pane = d3.select(selector).classed("bcedgepane", true).style("display", "none");
            var header = pane.append("div").classed("edge-pane-header", true);
            var title = header.append("div").classed("edge-pane-title", true).text(name);

            header.append("button").classed("bcbtn", true).classed("bcbtn-cancel", true)
                .on("click", function () {
                    obj.close();
                });

            var tabs = pane.append("div").classed("edge-pane-tabs", true);
            detailsTab = tabs.append("button").classed("edge-pane-tab", true).classed("selected", true).on("click", function () {
                selectTab(detailsTab, detailsPanel);
            }).text("Details");
            beaconsTab = tabs.append("button").classed("edge-pane-tab", true).on("click", function () {
                selectTab(beaconsTab, beaconsPanel);
            }).text("Beacons");
            messagesTab = tabs.append("button").classed("edge-pane-tab", true).on("click", function () {
                selectTab(messagesTab, messagesPanel);
            }).text("Messages");

            detailsPanel = pane.append("div").classed("edge-pane-panel", true);
            beaconsPanel = pane.append("div").classed("edge-pane-panel", true).style("display", "none");
            messagesPanel = pane.append("div").classed("edge-pane-panel", true).style("display", "none");

            detailsPanel.append("strong").text("MAC: ");
            detailsPanel.append("span").text(mac);

            noMsgText = messagesPanel.append("span").text("No messages to display");
            msgTable = messagesPanel.append("table").classed("edge-pane-table", true);

            var msgHead = msgTable.append("thead").append("tr");
            msgHead.append("th").text("Event");
            msgHead.append("th").text("Identifier");
            msgHead.append("th").text("Time");
            msgBody = msgTable.append("tbody");
            msgTable.style("display", "none");

            noBeaconsText = beaconsPanel.append("span").text("No beacons to display");
            beaconTable = beaconsPanel.append("table").classed("edge-pane-table", true);

            var beaconHead = beaconTable.append("thead").append("tr");
            beaconHead.append("th").text("Identifier");
            beaconHead.append("th").text("Dwell Time");
            beaconBody = beaconTable.append("tbody");
            beaconTable.style("display", "none");   
        }

        function selectTab(tab, panel) {
            detailsPanel.style("display", "none");
            beaconsPanel.style("display", "none");
            messagesPanel.style("display", "none");
            panel.style("display", null);
            detailsTab.classed("selected", false);
            beaconsTab.classed("selected", false);
            messagesTab.classed("selected", false);
            tab.classed("selected", true);
        }

        function updateBeacons() {
            var beacs;
            if (typeof core.devices[mac] == 'undefined' || typeof core.devices[mac].beacons == 'undefined')
                beacs = [];
            else {
                beacs = Object.keys(core.devices[mac].beacons).map(function(k) {
                    return core.devices[mac].beacons[k];
                });
                if (core.isFiltered())
                    beacs = beacs.filter(function(b) { return b.tracked } );
            }

            if (beacs.length == 0) {
                noBeaconsText.style("display", null);
                beaconTable.style("display", "none");
            }
            else {
                noBeaconsText.style("display", "none");
                beaconTable.style("display", null);
            }

            var rows = beaconBody.selectAll("tr").data(beacs, function (d) { return d.mac });

            rows.selectAll("td").remove();
            rows.append("td").text(function (d) { return core.getAutoIdentifier(d.mac) });
            rows.append("td").text(function (d) { return d.dwellTime + "s" });

            var newRow = rows.enter().append("tr");
            newRow.append("td").text(function (d) { return core.getAutoIdentifier(d.mac) });
            newRow.append("td").text(function (d) { return d.dwellTime + "s" });

            rows.exit().remove();
        }

        function addMsg(msg) {
            if (core.isFiltered() && !core.isTracked(msg.device.mac))
                return;
            msg.id = bclib.util.guid();
            if (msgs.length < msgQLength)
                msgs.push(msg);
            else {
                msgs.shift();
                msgs.push(msg);
            }
        }

        function renderMsgs() {
            if (msgs.length == 0) {
                noMsgText.style("display", null);
                msgTable.style("display", "none");
            }
            else {
                noMsgText.style("display", "none");
                msgTable.style("display", null);
            }

            var rows = msgBody.selectAll("tr").data(msgs, function (d) { return d.id });

            var newRow = rows.enter().append("tr");
            newRow.append("td").text(function (d) { return d.event.type });
            newRow.append("td").text(function (d) { return core.getAutoIdentifier(d.device.mac) });
            newRow.append("td").text(function (d) {
                var date = new Date(d.timestamp);
                return date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds();
            });

            rows.exit().remove();
        }
    };

    bclib.locationEngine.containers = {};

    bclib.locationEngine.containers.SimpleView = function(selector, core) {
        var obj = this;
        var core = core;
        var selector = selector;
        var lockButton;
        var locked = true;
        var maps = [];

        var errorMsg = d3.select(selector).append("div").style("text-align", "center");
        errorMsg.text("Waiting on Location Engine...");

        core.on("connect_failure", function () {
            errorMsg.text("Failed to connect to Location Engine");
        });

        core.on("setup_failure", function () {
            errorMsg.text("Failed to retrieve map and device information from Location Engine");
        });

        core.on("setup_success", createUI);

        function createUI() {
            d3.select(selector).classed("bcsimpleview", true);
            d3.select(selector).node().innerHTML = "";
            var mapsSelector = d3.select(selector).append("div").classed("maps-selector", true);
            var mapsContainer = d3.select(selector).append("div").classed("maps-container", true);
            var mapIds = core.getMapIds();
            var selectedMap;

            for (var i = 0; i < mapIds.length; i++) {
                var id = mapIds[i];
                var divId = "m_" + bclib.util.guid();
                var mapDiv = mapsContainer.append("div").attr("id", divId);
                var map = new bclib.locationEngine.Map("#" + divId, core, id);
                if (i == 0)
                    selectedMap = map;
                else
                    mapDiv.style("display", "none");

                (function (i, mapDiv, map) { 
                    mapsSelector.append("button").on("click", function() {
                        d3.select(selector).selectAll(".bclivemap").style("display", "none");
                        mapDiv.style("display", "block");
                        selectedMap = map;
                    }).classed("bcbtn", true).text(i);
                }(i, mapDiv, map));

                maps.push(map);
            }

            var mapControls = d3.select(selector).append("div").classed("map-controls", true);
            mapControls.append("button").classed("bcbtn", true).classed("bcbtn-zoom-in", true).on("click", function() {
                selectedMap.zoomIn();
            });
            mapControls.append("button").classed("bcbtn", true).classed("bcbtn-zoom-out", true).on("click", function() {
                selectedMap.zoomOut();
            });
            lockButton = mapControls.append("button").classed("bcbtn", true).classed("bcbtn-lock", true).on("click", function() {
                locked = !locked;
                lockButton.classed("bcbtn-lock", false);
                lockButton.classed("bcbtn-unlock", false);
                if (locked)
                    lockButton.classed("bcbtn-lock", true);
                else 
                    lockButton.classed("bcbtn-unlock", true);

                for (var i = 0; i < maps.length; i++) {
                    maps[i].lock(locked);
                }
            });
            mapControls.append("button").classed("bcbtn", true).classed("bcbtn-center", true).on("click", function() {
                selectedMap.resetScale();
            });
        }
    };

    bclib.locationEngine.containers.LiveView = function(selector, core) {
        var obj = this;
        var core = core;
        var maps = {};
        var selector = selector;
        var detailsShown = true;
        var container;
        var lowerContainer;
        var mapsContainer;
        var infoContainer;
        var filterContainer;
        var lockButton;
        var detailsButton;
        var filterButton;
        var filterSearch;
        var filterMatch;
        var filterTable;
        var panes;
        var paneCount = 0;
        var filtered = false;
        var filterBeaconMac = null;
        var selectedMap;
        var locked = true;

        var errorMsg = d3.select(selector).append("div").style("text-align", "center");
        errorMsg.text("Waiting on Location Engine...");

        core.on("connect_failure", function () {
            errorMsg.text("Failed to connect to Location Engine");
        });

        core.on("setup_failure", function () {
            errorMsg.text("Failed to retrieve map and device information from Location Engine");
        });

        core.on("setup_success", createUI);

        function createUI() {
            container = d3.select(selector).classed("bcliveview", true);
            container.node().innerHTML = "";
            var header = d3.select(selector).append("div").classed("holder-header", true);
            var mapsSelector = header.append("select").style("float", "left");
            var mapIds = core.getMapIds();

            var mainContainer = d3.select(selector).append("div").classed("main-container", true);
            filterContainer = mainContainer.append("div").classed("filter-container", true).style("display", "none").style("height", "30%");
            lowerContainer = mainContainer.append("div").style("height", "100%");
            mapsContainer = lowerContainer.append("div").classed("maps-container", true);
            infoContainer = lowerContainer.append("div").classed("info-container", true);
            var noEdgeDisplay = infoContainer.append("div").attr("style", "width: 100%; height: 100%; position: relative;");
            var filterLeft = filterContainer.append("div").classed("filter-left", true);
            var filterMiddle = filterContainer.append("div").classed("filter-middle", true);
            var filterRight = filterContainer.append("div").classed("filter-right", true);

            filterSearch = filterLeft.append("input").attr("placeholder", "Search For Beacon");
            filterSearch.on("keyup", fSearch);
            var filterInfo = filterLeft.append("div").classed("filter-info", true);
            var matchLine = filterInfo.append("div").style("text-align", "center");
            matchLine.append("strong").text("Match: ");
            filterMatch = matchLine.append("span").text("None");
            var filterAdd = filterLeft.append("button").on("click", addMatch).classed("bcbtn", true).text("Add");

            var t = filterRight.append("table");
            t.append("tr").append("th").text("Tracked Beacons");
            filterTable = t.append("tbody");

            drawTracked();

            noEdgeDisplay.append("div")
                .attr("style", "position: absolute; top: 50%; left:50%; transform: translateX(-50%) translateY(-50%)")
                .text("Click on a device to see its details");

            mapsSelector.on("change", function () {
                selectMap(mapsSelector.node().options[mapsSelector.node().selectedIndex].value);
            });

            header.append("button").classed("bcbtn", true).classed("bcbtn-zoom-in", true).style("float", "right").on("click", function() {
                selectedMap.zoomIn();
            });

            header.append("button").classed("bcbtn", true).classed("bcbtn-zoom-out", true).style("float", "right").on("click", function() {
                selectedMap.zoomOut();
            });

            lockButton = header.append("button").classed("bcbtn", true).classed("bcbtn-lock", true).style("float", "right").on("click", function() {
                locked = !locked;
                lockButton.classed("bcbtn-lock", false);
                lockButton.classed("bcbtn-unlock", false);
                if (locked)
                    lockButton.classed("bcbtn-lock", true);
                else 
                    lockButton.classed("bcbtn-unlock", true);

                for (key in maps) {
                    maps[key].lock(locked);
                }
            });

            header.append("button").classed("bcbtn", true).classed("bcbtn-center", true).style("float", "right").on("click", function() {
                selectedMap.resetScale();
            });

            detailsButton = header.append("button").classed("bcbtn", true).classed("bcbtn-hide-details", true).style("float", "right").on("click", toggleDetails);

            filterButton = header.append("button").classed("bcbtn", true).classed("bcbtn-filter", true).style("float", "right").on("click", toggleFilter);

            panes = {};

            for (key in core.devices) {
                var paneDiv = infoContainer.append("div").attr("id", "edgepane_" + key);
                panes[key] = new bclib.locationEngine.EdgePane("#edgepane_" + key, key, core.devices[key].name, core);
                panes[key].on("closed", function() {
                    paneCount--;
                    if (paneCount == 0)
                        noEdgeDisplay.style("display", null);
                });
                panes[key].on("opened", function() {
                    paneCount++;
                    if (!detailsShown)
                        toggleDetails();
                    noEdgeDisplay.style("display", "none");
                });
            }

            for (var i = 0; i < mapIds.length; i++) {
                var id = mapIds[i];
                var mapDiv = mapsContainer.append("div").attr("id", "map_" + id);
                var map = new bclib.locationEngine.Map("#map_" + id, core, id);
                maps[id] = map;
                mapsSelector.append("option").attr("value", id).text(core.getMapName(id));
                if (i == 0)
                    selectedMap = map;
                else
                    mapDiv.style("display", "none");

                map.on("device_click", function(mac) {
                    panes[mac].open();
                });
            }
        }

        function toggleDetails() {
            detailsShown = !detailsShown;
            if (detailsShown) {
                detailsButton.classed("bcbtn-hide-details", true);
                detailsButton.classed("bcbtn-expand-details", false);
                mapsContainer.style("width", null);
                infoContainer.style("display", null);
            }
            else {
                detailsButton.classed("bcbtn-hide-details", false);
                detailsButton.classed("bcbtn-expand-details", true);
                infoContainer.style("display", "none");
                mapsContainer.style("width", "100%");
            }
        }

        function toggleFilter() {
            filtered = !filtered;

            if (filtered) {
                filterButton.classed("bcbtn-filter", false);
                filterButton.classed("bcbtn-filter-pressed", true);
                filterContainer.style("display", null);
                lowerContainer.style("height", "70%");
                core.filter(true);
            }
            else {
                filterButton.classed("bcbtn-filter", true);
                filterButton.classed("bcbtn-filter-pressed", false);
                filterContainer.style("display", "none");
                lowerContainer.style("height", "100%");
                core.filter(false);
            }
        }

        function selectMap(id) {
            d3.select(selector).selectAll(".bclivemap").style("display", "none");
            d3.select(selector).select("#map_" + id).style("display", "block");
            selectedMap = maps[id];
        }

        function fSearch() {
            var sSearch = filterSearch.node().value;
            var matchedMacs = core.searchBeacons(sSearch);
            if (matchedMacs.length == 0) {
                filterBeaconMac = null;
                filterMatch.text("None");
            }
            else {
                filterBeaconMac = matchedMacs[0];
                filterMatch.text(core.getAutoIdentifier(filterBeaconMac));
            }
        }

        function addMatch() {
            if (filterBeaconMac == null)
                return;

            core.addBeaconToTracking(filterBeaconMac);
            drawTracked();
        }

        function drawTracked() {
            filterTable.node().innerHTML = "";
            if (core.trackedMacs.length == 0) {
                filterTable.append("tr").append("td").text("None");
                return;
            }
            for (var i=0; i < core.trackedMacs.length; i++) {
                var mac = core.trackedMacs[i];
                var row = filterTable.append("tr");
                var cell = row.append("td").text(core.getAutoIdentifier(mac));

                (function(row, mac) {
                    cell.append("button").classed("bcbtn", true).classed("bcbtn-cancel", true).on("click", function() {
                        core.removeBeaconFromTracking(mac);
                        drawTracked();
                    }); 
                })(row, mac);
            }
        }
    };

    bclib.locationEngine.containers.BasicZoneView = function(selector, core) {
        var obj = this;
        var selector = selector;
        var core = core;
        var renderTime = 100;
        var panels = [];

        obj.noLogo = function () {
            d3.select(selector).select(".bc-logo").style("display", "none");
        }

        var errorMsg = d3.select(selector).append("div").style("text-align", "center");
        errorMsg.text("Waiting on Location Engine...");

        core.on("connect_failure", function () {
            errorMsg.text("Failed to connect to Location Engine");
        });

        core.on("setup_failure", function () {
            errorMsg.text("Failed to retrieve map and device information from Location Engine");
        });

        core.on("setup_success", function () {
            createUI();
            setInterval(function () {
                render();
            }, renderTime);
        });

        function createUI() {
            var container = d3.select(selector).classed("bcbzoneview", true);
            container.node().innerHTML = "";
            container.append("div").classed("bc-logo",true);
            panelContainer = container.append("div").classed("panel-container", true);
            for (var i=0; i<6; i++) {
                var panel = panelContainer.append("div").classed("zone-panel", true);
                panel.title = panel.append("div").classed("panel-title", true)
                    .style("width", "100%")
                    .text("--");
                panel.append("div").classed("panel-sub-title", true)
                    .style("width", "50%")
                    .text("ZONE");
                panel.append("div").classed("panel-sub-title", true)
                    .style("width", "50%")
                    .text("DWELL");
                panel.zone = panel.append("div").classed("panel-value", true).classed("panel-value-bold", true)
                    .style("width", "50%")
                    .text("--");
                panel.dwell = panel.append("div").classed("panel-value", true)
                    .style("width", "50%")
                    .text("--");
                panel.append("div").classed("panel-sub-title", true)
                    .style("width", "33%")
                    .text("TEMP");
                panel.append("div").classed("panel-sub-title", true)
                    .style("width", "33%")
                    .text("TILT");
                panel.append("div").classed("panel-sub-title", true)
                    .style("width", "33%")
                    .text("BATT");
                panel.temp = panel.append("div").classed("panel-value", true)
                    .style("width", "33%")
                    .text("--");
                panel.angle = panel.append("div").classed("panel-value", true)
                    .style("width", "33%")
                    .text("--");
                panel.batt = panel.append("div").classed("panel-value", true)
                    .style("width", "33%")
                    .text("--");
                panels.push(panel);
            }
        }

        function render() {
            var count = 0;
            var keys = Object.keys(core.beacons);
            keys.sort();
            for (i in keys) {
                if (count == 6)
                    return;
                var current = core.beacons[keys[i]].currentZone ? core.beacons[keys[i]].currentZone.name.toUpperCase() : "--";
                var dwell = core.beacons[keys[i]].zoneDwellTime ? core.beacons[keys[i]].zoneDwellTime : 0;
                var temp = core.beacons[keys[i]].temperature ? core.beacons[keys[i]].temperature + String.fromCharCode(176) + "C" : "--";
                var angle = core.beacons[keys[i]].tiltY ? core.beacons[keys[i]].tiltY + String.fromCharCode(176) : "--";
                var batt = core.beacons[keys[i]].batteryLevel ? core.beacons[keys[i]].batteryLevel + "%" : "--";
                var panel = panels[count];

                panel.title.text(core.getAutoIdentifier(keys[i]).toUpperCase());
                panel.zone.text(current);

                //TODO: fix hardcodes                
                if (current==="EAST") {
                    panel.style("background-color", "#FFFFFF");
                }
                else if (current==="WEST"){
                    panel.style("background-color", "#EEEEEE");
                }
                else{
                    panel.style("background-color", "#DDDDDD");
                }

                var dwellDate = new Date();
                dwellDate.setHours(0,0,0);
                dwellDate.setSeconds(dwell);
                var dwellDisplay = "";
                if (dwellDate.getHours() != 0)
                    dwellDisplay += dwellDate.getHours() + "h ";
                if (dwellDate.getHours() != 0 || dwellDate.getMinutes() != 0)
                    dwellDisplay += dwellDate.getMinutes() + "m ";
                dwellDisplay += dwellDate.getSeconds() + "s";
                panel.dwell.text(dwellDisplay);

                panel.temp.text(temp);
                panel.angle.text(angle);
                panel.batt.text(batt);

                count++;
            }
        }
    };

    bclib.locationEngine.containers.TableTracker = function(selector, core) {
        var obj = this;
        var core = core;
        var selector = selector;
        var lockButton;
        var locked = true;
        var maps = [];

        var errorMsg = d3.select(selector).append("div").style("text-align", "center");
        errorMsg.text("Waiting on Location Engine...");

        core.on("connect_failure", function () {
            errorMsg.text("Failed to connect to Location Engine");
        });

        core.on("setup_failure", function () {
            errorMsg.text("Failed to retrieve map and device information from Location Engine");
        });

        core.on("setup_success", createUI);

        function createUI() {
            d3.select(selector).classed("bcsimpleview", true);
            d3.select(selector).node().innerHTML = "";
            var mapsSelector = d3.select(selector).append("div").classed("maps-selector", true);
            var mapsContainer = d3.select(selector).append("div").classed("maps-container", true);
            var mapIds = core.getMapIds();
            var selectedMap;

            for (var i = 0; i < mapIds.length; i++) {
                var id = mapIds[i];
                var divId = "m_" + bclib.util.guid();
                var mapDiv = mapsContainer.append("div").attr("id", divId);
                var map = new bclib.locationEngine.Map("#" + divId, core, id);
                if (i == 0)
                    selectedMap = map;
                else
                    mapDiv.style("display", "none");

                (function (i, mapDiv, map) { 
                    mapsSelector.append("button").on("click", function() {
                        d3.select(selector).selectAll(".bclivemap").style("display", "none");
                        mapDiv.style("display", "block");
                        selectedMap = map;
                    }).classed("bcbtn", true).text(i);
                }(i, mapDiv, map));

                maps.push(map);
            }

            var mapControls = d3.select(selector).append("div").classed("map-controls", true);
            mapControls.append("button").classed("bcbtn", true).classed("bcbtn-zoom-in", true).on("click", function() {
                selectedMap.zoomIn();
            });
            mapControls.append("button").classed("bcbtn", true).classed("bcbtn-zoom-out", true).on("click", function() {
                selectedMap.zoomOut();
            });
            lockButton = mapControls.append("button").classed("bcbtn", true).classed("bcbtn-lock", true).on("click", function() {
                locked = !locked;
                lockButton.classed("bcbtn-lock", false);
                lockButton.classed("bcbtn-unlock", false);
                if (locked)
                    lockButton.classed("bcbtn-lock", true);
                else 
                    lockButton.classed("bcbtn-unlock", true);

                for (var i = 0; i < maps.length; i++) {
                    maps[i].lock(locked);
                }
            });
            mapControls.append("button").classed("bcbtn", true).classed("bcbtn-center", true).on("click", function() {
                selectedMap.resetScale();
            });
        }
    };

    //API Module
    bclib.api = {};
    //options: url, auth, success, error
    bclib.api.get = function(options) {
        var request = new XMLHttpRequest();
        request.open('GET', 'https://api.bluecats.com' + options.url, true);
        //request.open('GET', 'http://localhost:65069' + options.url, true);

        request.setRequestHeader("Authorization", options.auth);
        request.setRequestHeader("X-Api-Version", 3);
        request.setRequestHeader("Content-Type", "application/json");

        request.onload = function() {
            if (request.status >= 200 && request.status < 400) {
                var data = JSON.parse(request.responseText);
                options.success(data);
            } 
            else
                options.error();
        };

        request.onerror = function() {
            options.error();
        };

        request.send();
    };

    bclib.api.getDevices = function(options) {
        bclib.api.get({
            url: '/Devices?siteID=' + options.siteID,
            auth: "BlueCats " + btoa("57644e5f-96ce-4169-b0ff-17146bdb8c10:" + options.username + ":" + options.password),
            success: options.success,
            error: options.error
        });
    };

    bclib.api.getMaps = function(options) {
        bclib.api.get({
            url: '/Maps?siteID=' + options.siteID,
            auth: "BlueCats " + btoa("57644e5f-96ce-4169-b0ff-17146bdb8c10:" + options.username + ":" + options.password),
            success: options.success,
            error: options.error
        });
    };

    bclib.api.getMap = function(options) {
        bclib.api.get({
            url: '/Maps/' + options.mapID,
            auth: "BlueCats " + btoa("57644e5f-96ce-4169-b0ff-17146bdb8c10:" + options.username + ":" + options.password),
            success: options.success,
            error: options.error
        });
    };

    bclib.api.getDeviceIdentifiers = function(options) {
        bclib.api.get({
            url: '/DeviceIdentifiers?siteID=' + options.siteID + '&q=' + options.sSearch,
            auth: "BlueCats " + btoa("57644e5f-96ce-4169-b0ff-17146bdb8c10:" + options.username + ":" + options.password),
            success: options.success,
            error: options.error
        });
    };

    this.bclib = bclib;
}();