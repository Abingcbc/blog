$(document).ready(function() {
    wrapImageWithFancyBox();
});

/**
 * Wrap images with fancybox support.
 */
function wrapImageWithFancyBox() {
    $('img').not('.sidebar-image img').not('#author-avatar img').not(".mdl-menu img").not(".something-else-logo img").not('[title=notice]').each(function() {
        var $image = $(this);
        var imageCaption = $image.attr('alt');
        var $imageWrapLink = $image.parent('a');

        if ($imageWrapLink.size() < 1) {
            var src = this.getAttribute('src');
            var idx = src.lastIndexOf('?');
            if (idx != -1) {
                src = src.substring(0, idx);
            }
            $imageWrapLink = $image.wrap('<a href="' + src + '"></a>').parent('a');
        }

        $imageWrapLink.attr('data-fancybox', 'images');
        if (imageCaption) {
            $imageWrapLink.attr('data-caption', imageCaption);
        }

    });

    $('[data-fancybox="images"]').fancybox({
      buttons : [ 
        'slideShow',
		'thumbs',
        'zoom',
        'fullScreen',
        'close'
      ],
      thumbs : {
        autoStart : false
      }
    });
}