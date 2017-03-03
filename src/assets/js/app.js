$(document).foundation();

/*
        $( function () {
            $( "#pinpad" ).pinpad( {
                appendTo: "#container"
            } );
        } );
*/
//var focusable = Foundation.Keyboard.findFocusable($('#container'));

$(document).ready(function () {

    $('.num').click(function () {
        var num = $(this);
        var text = $.trim(num.find('.txt').clone().children().remove().end().text());
        var telNumber = $('#telNumber');
        $(telNumber).val(telNumber.val() + text);
    });

});