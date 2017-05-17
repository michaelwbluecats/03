$(document).foundation();
var client;
var svg = Snap("#mapbg");
var g = svg.g();
var image;
var zones;
var exclusion_zone;
var shared_timeout;
var myFrames = [
    {animation: { opacity: 0.4, r: 150 }, dur: 1000 },
    {animation: { opacity: 0.2, r: 100 }, dur: 1000 },
    {animation: { opacity: 0.4, r: 150 }, dur: 1000 },
    {animation: { opacity: 0.2, r: 100 }, dur: 1000 }
];

function nextFrame ( el, frameArray,  whichFrame, callback ) {
    if( whichFrame >= frameArray.length ) { return callback(); }
    el.animate( frameArray[ whichFrame ].animation, frameArray[ whichFrame ].dur, mina.linear, nextFrame.bind( null, el, frameArray, whichFrame + 1, callback) );
}

function highlightZone(objZone){
    var zone = svg.g();
    var r = zone.circle(objZone.x,objZone.y,100).attr({ stroke: '#123456', 'strokeWidth': 2, fill: objZone["colour_code"], opacity: 0.2 });
    nextFrame(r, myFrames, 0, function(){
        zone.remove();
    });
}

function showZone(num){
    $("#btn-map-view").click();
    var event_beacon;
    _.forEach(bclib.locationEngine.beacons, function(beacon){
        console.log(beacon);
        var tag_num = parseInt(beacon.iBeacon.substring(36, 40), 16);
        if(tag_num == num){
            event_beacon = beacon;
        }
    });

    var event_edge;
    _.forEach(bclib.locationEngine.devices, function(device){
        if(event_beacon.edgeMAC == device.mac){
            event_edge = device;
        }
    });

    if(event_beacon && event_edge){
        var colour = _.find(zones, function(o) { return o.name == event_beacon.currentZone.name; });
        highlightZone({"x":event_edge.x, "y": event_edge.y, "colour_code": colour["colour_code"]});
        $('.callout').css('background-color', colour["colour_code"]);
        $('.callout').css('border', '2px ' + colour["colour_code"]);
        $('.callout').html('<h4>Tag ' + num + '</h4> <h3><b>' + event_beacon.currentZone.name + '</b></h3>').show();
        shared_timeout = setTimeout(function(){
            $('.callout').hide();
        }, 8000)
    }else{
        $('.callout').css('background-color', 'red');
        $('.callout').css('border', '2px red');
        $('.callout').html('<h4>Tag not found</h4>').show();
        shared_timeout = setTimeout(function(){
            $('.callout').hide();
        }, 8000)
    }
}

$('.num').click(function () {
    clearTimeout(shared_timeout);
    $('.callout').hide();
    var num = $(this);
    var text = $.trim(num.find('.txt').clone().children().remove().end().text());
    var telNumber = $('#telNumber');
    if(text === 'Search'){
        showZone($(telNumber).val());
        $(telNumber).val('');
    } else if(text === 'Del'){
        $(telNumber).val('');
    }
    else {
        $(telNumber).val(telNumber.val() + text);
    }
});

$(document).ready(function(){

    $('.callout').hide();
    $.getJSON('./assets/json/config_bluecats_demo.json', function(data) {
        zones = data.zones;
        exclusion_zone = data.exclusion_zone;
        bclib.locationEngine.Core(data.ip, data.site);
        bclib.locationEngine.on('setup_success', function(x){
            var map = bclib.locationEngine.getMapInfo(data.map);
            svg.attr({width: map.width, height: map.height});
            image = g.image(data.image, 0, 0);
            bclib.locationEngine.on('location_update', function(x){
                var html = '';
                var activeTags = 0;
                var objCount = _.findLastIndex(_.values(bclib.locationEngine.beacons), function(o) { return o.currentZone != null &&  exclusion_zone != o.currentZone.name; });
                _.forEach(bclib.locationEngine.beacons, function(beacon, index){
                    if(!beacon.currentZone || exclusion_zone == beacon.currentZone.name){
                        return;
                    }
                    activeTags++;
                    var colour = _.find(zones, function(o) { return o.name == beacon.currentZone.name; });
                    var tag_num = parseInt(beacon.iBeacon.substring(36, 40), 16);
                    html += '<div class="small-12 medium-4 large-3 columns ' + (activeTags === objCount ? "end" : "") + '"><a class="list-details" href="javacript:void(0)" onclick="showZone(' + tag_num + ')"><table><tbody><tr><td rowspan="3" >' +
                    '<div class="tag-number">' + tag_num + '</div>' +
                        '</td><td class="tag-location" rowspan="2" style="background-color:' + colour.colour_code + ';">' +
                        '<h5>' + (beacon.currentZone ? beacon.currentZone.name : '') + '</h5>' +
                        '</td></tr><tr><td class="tag-dwell-time" style="background-color: #black; display: none;"><h6>' +
                    '<span class="">' + moment.duration(beacon.zoneDwellTime, 'seconds').humanize() + '</span></h6>' +
                    '</td></tr></tbody></table></a></div>';
                });
                $('#activeTags').html(activeTags);
                $('#listContent').html(html);
            });
        });
        bclib.locationEngine.start();

    });
});