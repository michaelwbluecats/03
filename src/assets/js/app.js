$(document).foundation();
var client;
var svg = Snap("#mapbg");
var g = svg.g();
var image;
var config;
var maps = [];
var shared_timeout;
var proportion;
var offset = 0;
var myFrames;
var view = 'map';

function nextFrame ( el, frameArray,  whichFrame, callback ) {
    if( whichFrame >= frameArray.length ) { return callback(); }
    el.animate( frameArray[ whichFrame ].animation, frameArray[ whichFrame ].dur, mina.linear, nextFrame.bind( null, el, frameArray, whichFrame + 1, callback) );
}

function highlightZone(objZone){
    var zone = svg.g();
    var r = zone.circle(objZone.x,objZone.y, config.zone_radius).attr({ stroke: '#123456', 'strokeWidth': 2, fill: objZone["colour_code"], opacity: 0.2 });
    /*nextFrame(r, myFrames, 0, function(){
        zone.remove();
    });
    */
}

function showZone(num, returnTo){

    var event_beacon;
    _.forEach(bclib.locationEngine.beacons, function(beacon){
        if(!beacon.bcIdentifier){
            return;
        }
        var tag_num = parseInt(beacon.bcIdentifier.substring(26, 30), 16);
        if(tag_num == num){
            event_beacon = beacon;
        }
    });

    if(!event_beacon){
        return;
    }

    var event_edge;
    _.forEach(bclib.locationEngine.devices, function(device){
        if(event_beacon.edgeMAC == device.mac){
            event_edge = device;
        }
    });

    $("#btn-map-view").click();
    if(event_beacon && event_edge){
        var map = _.find(maps, function(m) { return m.id  == event_edge.mapID; });
        loadMap(map);
        var colour = _.find(config.zones, function(o) { return o.name == event_beacon.currentZone.name; });
        highlightZone({"x": offset + (proportion ? event_edge.x * proportion : event_edge.x), "y": (proportion ? event_edge.y * proportion : event_edge.y), "colour_code": colour["colour_code"]});
        $('.overlay').css('background-color', colour["colour_code"]);
        $('.overlay').css('border', '2px ' + colour["colour_code"]);
        $('.overlay').html('<div class="overlay-text"><h4>Tag ' + num + '&nbsp;&nbsp;<b>' + event_beacon.currentZone.name + '</b></h4></div>').show();
        shared_timeout = setTimeout(function(){
            $('.overlay').hide();
            if(returnTo){
                $(returnTo == 'map' ? '#btn-map-view' : '#btn-list-view').click();
            }
        }, config.notification_duration)
    }else{
        $('.overlay').css('background-color', 'red');
        $('.overlay').css('border', '2px red');
        $('.overlay').html('<div class="overlay-text"><h4>Tag not found</h4></div>').show();
        shared_timeout = setTimeout(function(){
            $('.overlay').hide();
            if(config.default_view){
                $(config.default_view == 'map' ? '#btn-map-view' : '#btn-list-view').click();
            }
        }, config.notification_duration)
    }
}

function loadMap(map){
    var w;
    var h;
    var maxw = $('.mapdisplay').width();
    var maxh = $('.mapdisplay').height();
    var propw = (map.width * 100) / maxw;
    var proph = (map.height * 100) / maxh;

    if(propw >= proph){
        w = maxw;
        h = (map.height * maxw) / map.width;
    }else{
        h = maxh;
        w = (map.width * maxh) / map.height;
    }
    svg.attr({width: maxw, height: maxh});
    if(image) {
        image.remove();
    }

    image = g.image(map.image, ((maxw - w)/2), 0, w, h);
    proportion = (w / map.width);
    offset = ((maxw - w)/2);
}

$(document).ready(function(){
    $(document).on('keypress', function(e) {
        var telNumber = $('#telNumber');
        var intkey = _.parseInt(e.key);
        if(!_.isNaN(intkey)){
            $(telNumber).val(telNumber.val() + intkey);
        }else if(e.key == 'Enter'){
            showZone($(telNumber).val());
            $(telNumber).val('');
        }else if(e.key == '.'){
            $(telNumber).val('');
        }
    });

    $('#imgLogo').click(function(){
        location.reload(true);
    });

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

    $('#btn-swap-view').click(function () {
        if(view == 'map'){
            view = 'list';
            $('#btn-list-view').click();
        }else{
            view = 'map';
            $('#btn-map-view').click();
        }
    });


    $('.overlay').hide();
    $.getJSON('./config.json', function(data) {
        config = data;
        var quarter_duration = config.notification_duration / 4;
        var radius = config.zone_radius;
        myFrames = [
            {animation: { opacity: 0.4, r: radius + (radius / 4) }, dur: quarter_duration },
            {animation: { opacity: 0.2, r: radius }, dur: quarter_duration },
            {animation: { opacity: 0.4, r: radius + (radius / 4) }, dur: quarter_duration },
            {animation: { opacity: 0.2, r: radius }, dur: quarter_duration }
        ];
        bclib.locationEngine.Core(data.ip, data.site);
        bclib.locationEngine.on('setup_success', function(x){
            console.log(bclib.locationEngine);
            var mapIds = bclib.locationEngine.getMapIds();
            _.each(mapIds, function(map){
                var mapInfo = bclib.locationEngine.getMapInfo(map);
                console.log(mapInfo);
                mapInfo.image = mapInfo.url;
                //mapInfo.image = map.image;
                maps.push(mapInfo);
            });

            loadMap(maps[0]);

            bclib.locationEngine.on('location_update', function(x){
                var html = '';
                var activeTags = 0;
                var beacons = _.sortBy(bclib.locationEngine.beacons, [function(beacon) { return ( beacon.bcIdentifier ? parseInt(beacon.bcIdentifier.substring(26, 30), 16) : 0); }]);
                _.forEach(beacons, function(beacon, index){
                    if(!beacon.currentZone || !beacon.bcIdentifier || config.exclusion_zone == beacon.currentZone.name){
                        return;
                    }
                    activeTags++;
                    var colour = _.find(config.zones, function(o) { return o.name == beacon.currentZone.name; });
                    if(!colour){
                        colour = '#000000';
                    }
                    var tag_num = parseInt(beacon.bcIdentifier.substring(26, 30), 16);
                    var device_type = parseInt(beacon.bcIdentifier.substring(20, 22), 16);
                    if(config.show_dwell_time){
                        html += '<div style="position: relative" class="small-12 medium-4 large-3 columns ' + (device_type == 2 ? 'mobile-2 ' : ' ') + (index == (beacons.length -1) ? "end" : "") + '"><a class="list-details" onclick="showZone(' + tag_num + ', \'list\')"><table><tbody><tr><td rowspan="3" >' +
                            '<div class="tag-number">' + tag_num + '</div>' +
                            '</td><td class="tag-location" rowspan="2" style="background-color:' + colour.colour_code + ';">' +
                            '<h5>' + (beacon.currentZone ? beacon.currentZone.name : '') + '</h5>' +
                            '</td></tr><tr><td class="tag-dwell-time" style="background-color: #black;"><h6>' +
                            '<span class="">' + moment.duration(beacon.zoneDwellTime, 'seconds').humanize() + '</span></h6>' +
                            '</td></tr></tbody></table></a></div>';
                    }else{
                        html += '<div style="position: relative" class="small-12 medium-4 large-3 columns ' + (device_type == 2 ? 'mobile-2 ' : ' ') + (index == (beacons.length -1) ? "end" : "") + '"><a class="list-details" onclick="showZone(' + tag_num + ', \'list\')"><table><tbody><tr><td rowspan="3" >' +
                            '<div class="tag-number">' + tag_num + '</div>' +
                            '</td><td class="tag-location" rowspan="2" style="background-color:' + colour.colour_code + ';">' +
                            '<h5>' + (beacon.currentZone ? beacon.currentZone.name : '') + '</h5>' +
                            '</td></tr><tr></tr></tbody></table></a></div>';
                    }

                });
                $('#activeTags').html(activeTags);
                $('#listContent').html(html);
            });
        });
        bclib.locationEngine.start();

    });
});