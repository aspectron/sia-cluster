$(document).ready(function() {
	$("#login").click(function() {
		var user = $("#user").val();
		var pass = $("#pass").val();
		if(!user || !pass)
			return $("#status").html("Please supply a valid username and password");
		var hash = CryptoJS.SHA256(CryptoJS.enc.Utf8.parse(pass)).toString();
		var sig = CryptoJS.HmacSHA256(CryptoJS.enc.Hex.parse(hash), CryptoJS.enc.Hex.parse(salt)).toString();

        $.ajax({
            url: '/manage/login',
            type: 'POST',
            dataType: "json",
            data: { 
            	user : user,
            	sig : sig
            }
        }).done(function (data) {
        	console.log("SUCCESS:",arguments);
        	if(data.ack == salt)
        		window.location.assign('/manage');
        	else
        		$("#status").html(data.ack);
        }).fail(function (jqXHR) {
        	console.log("FAILURE:",arguments);
            $("#status").html(jqXHR.statusText);
        });
	})
	$("#user").keydown(function(e) {
		if(e.which == 13)
			$("#login").trigger('click');
	})
	$("#pass").keydown(function(e) {
		if(e.which == 13)
			$("#login").trigger('click');
	})
	$("#user").focus();
})