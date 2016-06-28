function API($){
	var self = this;

	self.isTouchDevice = navigator.userAgent.match(/(iPhone|iPod|iPad|Android|playbook|silk|BlackBerry|BB10|Windows Phone|Tizen|Bada|webOS|IEMobile|Opera Mini)/);
	self.isTouch = (('ontouchstart' in window) || (navigator.msMaxTouchPoints > 0) || (navigator.maxTouchPoints));

	self.error = function(err, title, callback) {
		if (err.logout) {
			console.log("API:error:::::", err)
			window.location.href = '/login?redirect_uri=' + encodeURIComponent(window.location.href);
			return
		};
		if (err.loginRequired)
			return
		if (err){
			if (err.error) {
				self.alert({title: title || "Error", text:err.error}, callback)
			}else if (err.warning) {
				self.alert({title: title || "Warning", text:err.warning}, callback)
			}else if (err.info) {
				self.alert({title: title || "Info", text:err.info}, callback)
			}
		};
		//err && alert(err.error);
		return err;
	}

	self.buildAlertDialog = function(args, callback){
		var $dialog = $('.alert-dialog');
		$dialog.find('.title-text').html(args.title);
		$dialog.find('.msg-text').html(args.text);
		$dialog.find('.mdl-card__menu').hide();
		$dialog.find('.cancel-btn').html(args.cancelBtn || 'CANCEL').hide();
		$dialog.find('.ok-btn').html(args.okBtn || 'OK');
		$dialog[0].callback = callback || false;
		if (!$dialog[0].callbackBind) {
			$dialog[0].callbackBind = true;
			$dialog.find('.ok-btn').on('click', function () {
				$dialog.irisDialog(false);
				$dialog[0].callback && $dialog[0].callback('ok');
			});
			$dialog.find('.cancel-btn').on('click', function () {
				$dialog.irisDialog(false);
				$dialog[0].callback && $dialog[0].callback('cancel');
			})
		};
		return $dialog;
	}

	self.alert = function (args, callback) {
		var $dialog = self.buildAlertDialog(args, callback);
		$dialog.irisDialog(true);
	}
	/*
	Api.confirm({title: "Are you sure?", text:"Do you want to delete item", okBtn: "DELETE", cancelBtn: "No"}, function (btn) {
		if (btn == 'ok') { deleteItem() };
	});
	*/
	self.confirm = function (args, callback) {
		var $dialog = self.buildAlertDialog(args, callback);
		$dialog.find('.cancel-btn').show();
		$dialog.irisDialog(true);
	}

	self.setAlertMsg = function (info, msgHolder){
		var $status = $(msgHolder || '.alert-msg');
		if (info.error) {
			$status.find('div').html(info.error);
			$status.addClass('error');
		}else{
			$status.find('div').html(info.message);
			$status.removeClass('error');
		}

		$status.fadeIn();
	}

	self.post = function(path, data, callback, method) {
	    $.ajax({
	        dataType: "json",
	        method : method || 'POST',
	        url: path,
	        data: data,
	        error : function(err) {
	            if(err.responseJSON) {
	                if (err.responseJSON.error)
	                    callback(err.responseJSON);
	                else if (err.responseJSON.request) {
	                    callback({ request : err.responseJSON.request });
	                }
	            } else
	                callback({ error : err.statusText });
	        },
	        success: function(o) {
	            callback(null, o);
	        }
	    })
	}

	self.get = function(path, data, callback) {
	    self.post(path, data, callback, "GET")
	}

	self.hideLoading = function () {
		$('body').removeClass('loading');
	}

	self.showLoading = function () {
		$('body').addClass('loading');
	}

	self.handleMsg = function(holderSelector){
		if (!window.App || !window.App.msg)
			return;

		var $el = $(holderSelector);
		$el.removeClass('error');

		check(window.App.msg);

		function check(msg){
			$.each(msg, function(key, a){
				console.log(key, a)
				if ($.type(a) == "string") {
					$el.find('div').html(a);
					$el.fadeIn();
				}else if($.type(a) == "array"){
					$.each(a, function(_key, info){
						if ($.type(info.error) == "string") {
							if (info.code != "access_denied") {//dont show is user have denied access to login, he know what he did
								$el.find('div').html(info.error);
								$el.fadeIn();
							};
						}else if (info.error) {
							check(info.error)
							$el.addClass('error')
						}else if(key == 'activation' && info.success){
							$el.find('div').html(a.message || "Activation completed. Now you can Sign-In");
							$el.fadeIn();
						}
					});
				}else if($.type(a) == "object"){
					console.log(key+"sssss", a)
					if (a.error) {
						check(a.error)
						$el.addClass('error')
					}else if(key == 'activation' && a.success){
						$el.find('div').html(a.message || "Activation completed. Now you can Sign-In");
						$el.fadeIn();
					}
				}
			})
		}
	};

	self.activatePage = function(index){
		//$('#pages').get(0).selected = index;
		var current = $('.app-pages').attr('current');
		if (current==index){
			return;
		};
		var cls = {
			in: "moveFromRight",
			out: "moveToLeft"
		}

		if (current < index) {
			cls = {
				in: "moveFromLeft",
				out: "moveToRight"
			}
		};


		PageTransitions.animate({
			block: $('.app-pages').get(0),
			page: index,
			inClass: cls.in,
			outClass: cls.out
		});
	},
	self.changeLocale = function(url) {
		window.location.href = url+window.location.hash;
	}

}

var Api = new API(jQuery);
(function($){
$(document).ready(function(){
	Api.handleMsg('.alert-msg');

	$('.alert .close').on('click', function(){
		$(this).closest('.alert').fadeOut();
	});
	$('.dialog .close-dialog').on('click', function(){
		$(this).closest('.dialog').irisDialog(false);
	})

	$('.home-page .mdl-layout__content').on('scroll', function(e){
		$(document.body).toggleClass('fixed-header', $(this).scrollTop()+64 > $('#videocontainer').height());//+$('.mdl-layout__header-row').height())
		//console.log("sss", e, )
	})

	$('.scroll-to').on('click', function(){
		var $to = $($(this).data('el'));
		var $scroller = $('.mdl-layout__content');
		$scroller.animate({
			scrollTop: $scroller.scrollTop() + $to.offset().top
		});
	})
	//$('.app-pages').height($('.app-pages').parent().height());
	//$(document.body).append($('.modal-dialog-back'));

	$.fn.irisDialog = function(open){

		if (!$._irisDialogResizer) {
			$(window).on('resize', function(){
				$('.iris-js-dialog:visible').each(function () {
					$._irisDialogResizer($(this));
				})
			});

			$._irisDialogResizer = function ($dialog) {
				$dialog.css({
					top: ( $(window).height() - $dialog.outerHeight())/2 ,
					left: ( $(window).width() - $dialog.outerWidth())/2 ,
					margin: 0
				});
			}
		};

		var $dialog = $(this);

		$._irisDialogResizer($dialog);
		
		if (open === true){
			if ($dialog.hasClass('modal')) {
				$._irisDialogModalCount++;
				$('.modal-dialog-back').fadeIn();
			};
			$dialog.removeClass('mdl-hidden')
			$dialog.fadeIn();
		}else if(open === false){
			$dialog.fadeOut();
			if($._irisDialogModalCount > 0){
				$._irisDialogModalCount--;
			}

			if($._irisDialogModalCount <= 0){
				$._irisDialogModalCount = 0;
				$('.modal-dialog-back').fadeOut();
			}
		}

	}
	$._irisDialogModalCount = 0;
});
})(jQuery);



