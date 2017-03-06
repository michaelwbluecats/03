$(document).foundation();
$(document).ready(function () {
    /*var client = EdgeBrokerClient.create({"ip": "10.14.1.44", "site":"d2f74800-3ea2-7da1-d34e-d27f15b00630", "map":"2f134a00-28a7-98a4-cb4d-4db0ed45a0e6"});
    client.connect();
    client.on('beacon_changed_zone', function(beacon, newZone){
        console.log('beacon ' + beacon + ' entered ' + newZone);
        //console.log(newZone);
    });*/
    var svg = Snap("#container");
    var g = svg.g();
    var image = g.image("/assets/img/bankstown.jpg", 0,0, 1401,995 );

    var myFrames = [
        {animation: { opacity: 0.4, r: 150 }, dur: 500 },
        {animation: { opacity: 0.2, r: 100 }, dur: 500 },
        {animation: { opacity: 0.4, r: 150 }, dur: 500 },
        {animation: { opacity: 0.2, r: 100 }, dur: 500 }
    ];

    function nextFrame ( el, frameArray,  whichFrame, callback ) {
        if( whichFrame >= frameArray.length ) { return callback(); }
        el.animate( frameArray[ whichFrame ].animation, frameArray[ whichFrame ].dur, mina.linear, nextFrame.bind( null, el, frameArray, whichFrame + 1, callback) );
    }

    function showZone(num){
        var zone = svg.g();
        var r = zone.circle(400,700,100).attr({ stroke: '#123456', 'strokeWidth': 2, fill: 'blue', opacity: 0.2 });
        nextFrame(r, myFrames, 0, function(){
            zone.remove();
        });
    }

    $('.num').click(function () {
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

});