dojo.require("dijit.layout.BorderContainer");
dojo.require("dijit.layout.ContentPane");
dojo.require("dijit/Dialog");
dojo.require("esri.arcgis.utils");
dojo.require("esri.map");
dojo.require("esri/dijit/PopupTemplate");
dojo.require("esri/geometry/Extent");
dojo.require("esri/SpatialReference");

var _mapSat;
var _mapOV;
var _scroll;
var _sourcePointLayer;
var _sourceRegioniLayer;
var _locations;
var _locationsRegioni;
var _selected;
var _selectedRegione;
var _popup;

var _initialCenter;

var _divMapRight;
var _divMapLeft;

var _introScroller;

var _lutIconSpecs = {
    normal: new IconSpecs(24, 30, 3, 8),
    medium: new IconSpecs(26, 32, 3, 8),
    large: new IconSpecs(32, 40, 3, 11)
}

var STATE_INTRO = 0;
var STATE_TABLE = 1;
var STATE_INFO = 2;

var _currentState = STATE_INTRO;

var ICON_ALERT_PREFIX = "resources/icons/alert/number_";
var ICON_ALERT_SUFFIX = ".png";
var ICON_SPIAGGE_PREFIX = "resources/icons/spiagge/number_";
var ICON_SPIAGGE_SUFFIX = ".png";
var ICON_ECOMOSTRI_PREFIX = "resources/icons/ecomostri/number_";
var ICON_ECOMOSTRI_SUFFIX = ".png";
var ICON_PAESAGGI_PREFIX = "resources/icons/paesaggi/number_";
var ICON_PAESAGGI_SUFFIX = ".png";
var ICON_UNKNOW_PREFIX = "resources/icons/unknow/number_";
var ICON_UNKNOW_SUFFIX = ".png";
var _dojoReady = false;
var _jqueryReady = false;

var _isMobile = isMobile();
var _isLegacyIE = ((navigator.appVersion.indexOf("MSIE 8") > -1) || (navigator.appVersion.indexOf("MSIE 7") > -1));
var _isIE = (navigator.appVersion.indexOf("MSIE") > -1)

var _isEmbed = false;

dojo.addOnLoad(function () { _dojoReady = true; init() });
jQuery(document).ready(function () { _jqueryReady = true; init() });

if (document.addEventListener) {
    document.addEventListener('touchmove', function (e) { e.preventDefault(); }, false);
} else {
    document.attachEvent('touchmove', function (e) { e.preventDefault(); }, false);
}

var _counter = 0;

function init() {

    if (!_jqueryReady) return;
    if (!_dojoReady) return;

    if (_configOptions.proxyURL) esri.config.defaults.io.proxyUrl = _configOptions.proxyURL;

    _divMapRight = $("#map");
    _divMapLeft = $("#mapOV");

    $("#info").css("padding-left", _configOptions.popupLeftMargin);

    // determine whether we're in embed mode

    var queryString = esri.urlToObject(document.location.href).query;
    if (queryString) {
        if (queryString.embed) {
            if (queryString.embed.toUpperCase() == "TRUE") {
                _isEmbed = true;
                $("body").width(600);
                $("body").height(400);
            }
        }
    }

    _popup = new esri.dijit.Popup(null, dojo.create("div"));

    var mapLargeScale = esri.arcgis.utils.createMap(_configOptions.webmap_largescale, "map", {
        mapOptions: { slider: true, wrapAround180: true },
        ignorePopups: true
    });

    mapLargeScale.addCallback(function (response) {
        _mapSat = response.map;
        if (_mapSat.loaded) {
            initMap();
        } else {
            dojo.connect(_mapSat, "onLoad", function () {
                initMap();
            });
        }
    });

    var mapDeferred = esri.arcgis.utils.createMap(_configOptions.webmap_overview, "mapOV", {
        mapOptions: {
            slider: true,
            wrapAround180: false
        },
        ignorePopups: false,
        infoWindow: _popup
    });
    mapDeferred.addCallback(function (response) {

        if ((_configOptions.title == null) || (_configOptions.title == "")) _configOptions.title = response.itemInfo.item.title;
        if ((_configOptions.subtitle == null) || (_configOptions.subtitle == "")) _configOptions.subtitle = response.itemInfo.item.snippet;

        $("#title").append(_configOptions.title);
        $("#subtitle").append(_configOptions.subtitle);
        $("#description").html(response.itemInfo.item.description);
        $(document).attr("title", _configOptions.title);

        if (!_configOptions.showIntro) {
            $("#intro").css("display", "none");
        }

        $("#info").height(_configOptions.popupHeight);

        _mapOV = response.map;
        _mapOV.graphics.hide();

        if (_configOptions.contentLayerOverride) {
            _sourcePointLayer = _mapOV.getLayer(_configOptions.contentLayerOverride);
        } else {
            var sourcePointId = $.grep(response.itemInfo.itemData.operationalLayers, function (n, i) { return n.title == _configOptions.contentLayer })[0].featureCollection.layers[0].id;
            _sourcePointLayer = _mapOV.getLayer($.grep(_mapOV.graphicsLayerIds, function (n, i) { return _mapOV.getLayer(n).id == sourcePointId })[0]);
            var sourceRegioniId = $.grep(response.itemInfo.itemData.operationalLayers, function (n, i) { return n.title == _configOptions.contentRegioniLayer })[0].featureCollection.layers[0].id;
            _sourceRegioniLayer = _mapOV.getLayer($.grep(_mapOV.graphicsLayerIds, function (n, i) { return _mapOV.getLayer(n).id == sourceRegioniId })[0]);
        }

        _locations = _sourcePointLayer.graphics;
        _locationsRegioni = _sourceRegioniLayer.graphics;

        $.each(_locations, function (index, value) { value.attributes.getValueCI = getValueCI }); // assign extra method to handle case sensitivity
        $.each(_locationsRegioni, function (index, value) { value.attributes.getValueCI = getValueCI }); // assign extra method to handle case sensitivity
        _locations.sort(compare);
        _locationsRegioni.sort(compare);

        loadList();

        if (_isMobile) {
            _scroll = new iScroll('wrapper', { snap: 'li', momentum: true });
            $("#innerIntro").height(1000);
            _introScroller = new iScroll('intro');
        } else {
            $("#wrapper").css("overflow", "hidden");
            $("#thelist").css("overflow-x", "hidden");
            $("#thelist").css("overflow-y", "scroll");
        }

        $("#mapOV .esriSimpleSlider").hide();

        dojo.connect(_sourcePointLayer, "onMouseOver", layer_onMouseOver);
        dojo.connect(_sourcePointLayer, "onMouseOut", layer_onMouseOut);
        dojo.connect(_sourcePointLayer, "onClick", layer_onClick);

        dojo.connect(_sourceRegioniLayer, "onMouseOver", layer_onMouseOverRegione);
        dojo.connect(_sourceRegioniLayer, "onMouseOut", layer_onMouseOutRegione);
        dojo.connect(_sourceRegioniLayer, "onClick", layer_onClickRegione);

        dojo.connect(_mapOV.getLayer("mapOV_graphics"), "onClick", layer_onFlickr);
        dojo.connect(_mapOV.infoWindow, "onSetFeatures", checkinfoshow);

        if (_mapOV.loaded) {
            initMap();
        } else {
            dojo.connect(_mapOV, "onLoad", function () {
                initMap();
            });
        }

    });
}

function initMap() {

    if (!_mapSat || !_mapOV) {
        // kicking out because one of the maps doesn't exist yet...
        return null;
    }

    if (!_mapSat.loaded || !_mapOV.loaded) {
        // kicking out because one of the maps hasn't loaded yet...
        return null;
    }

    //mark the initial center, because maps are about to get resized, 
    //and we may need to re-establish the center.
    _initialCenter = _mapOV.extent.getCenter();

    $("#case #blot").css("left", $("#case").width());

    switchMaps();

    setTimeout(function () {
        if (_scroll) { _scroll.refresh() }
        var level = ($(_divMapRight).width() / $(_divMapRight).height() > 1.2) ? _configOptions.initialZoomLevelWide : _configOptions.initialZoomLevel;
        _mapSat.centerAt(_initialCenter);
        if (!_isLegacyIE) {
            _mapOV.centerAndZoom(_initialCenter, level);
            $("#whiteOut").fadeOut("slow");
        } else {
            _mapOV.centerAndZoom(_initialCenter, 12);
            setTimeout(function () { _mapOV.centerAndZoom(_initialCenter, level); $("#whiteOut").fadeOut("slow"); }, 1000);
        }
    }, 500);

    // jQuery event assignment

    $(this).resize(handleWindowResizeFlip);

    $("#topRow .numberDiv").click(function (e) {
        pageUp();
    });

    $("#topRow #iconList").click(function (e) {
        changeState(STATE_TABLE);
    });

    $("#bottomRow .numberDiv").click(function (e) {
        pageDown();
    });

    $(document).keydown(onKeyDown);

    $("li").click(listItemClick);

    $("#flipper").click(function (e) {
        switchMapsFlip();
    });

    $("#mapOV").hover(function (e) {
        $("#mapOV .esriSimpleSlider").fadeIn();
    }, function (e) {
        $("#mapOV .esriSimpleSlider").fadeOut();
    });

    $("#iconHome").click(function (e) {
        preSelection();
        if (_configOptions.showIntro) {
            changeState(STATE_INTRO);
        } else {
            changeState(STATE_TABLE);
        }
        scrollToPage(0);
        //if ($(_divMapRight).attr("id") == "map") switchMaps();
        setTimeout(function () {
            var level = ($(_divMapRight).width() / $(_divMapRight).height() > 1.2) ? _configOptions.initialZoomLevelWide : _configOptions.initialZoomLevel;
            _mapOV.centerAndZoom(_initialCenter, level);
        }, 500);
        _counter = 0;
    });

    $("#iconLeft").click(function (e) {
        changeState(STATE_INFO);
    });

}

function transfer() {
    var arr = $.grep(_sourcePointLayer.graphics, function (n, i) {
        return n.attributes.getValueCI(_configOptions.fieldName_Rank) == _selected.attributes.getValueCI(_configOptions.fieldName_Rank);
    });
    //_mapOV.infoWindow.setFeatures([arr[0]]);
    _mapOV.infoWindow.hide();
    var flickr_html_model = "";
    var image_html_model = "";
    var popup_html_model = "<div class=\"esriViewPopup\">";
    popup_html_model += "<div class=\"header " + _selected.attributes.Tag + "\">" + _selected.attributes.Name + "</div> <div class=\"hzLine " + _selected.attributes.Tag + "\"></div>";
    if (_selected.attributes.Flickr_Url !== undefined && _selected.attributes.Flickr_Url != null && _selected.attributes.Flickr_Url != "") {
        popup_html_model += "<div class=\"mediaSection-popup\"> <div class=\"gallery\">";
        popup_html_model += "<object width=\"640\" height=\"480\">";
        popup_html_model += "<param name=\"flashvars\" value=\"offsite=true&lang=it-it&page_show_url=%2Fphotos%2Fatlantecostelegambiente%2Fsets%2F" + _selected.attributes.Flickr_Url + "%2Fshow%2F&page_show_back_url=%2Fphotos%2Fatlantecostelegambiente%2Fsets%2F" + _selected.attributes.Flickr_Url + "%2F&set_id=" + _selected.attributes.Flickr_Url + "&jump_to=\" />";
        popup_html_model += "<param name=\"movie\" value=\"http://www.flickr.com/apps/slideshow/show.swf?v=140556 />";
        popup_html_model += "<param name=\"allowFullScreen\" value=\"true\" />";
        popup_html_model += "<embed type=\"application/x-shockwave-flash\" src=\"http://www.flickr.com/apps/slideshow/show.swf?v=140556\" allowfullscreen=\"true\" flashvars=\"offsite=true&lang=it-it&page_show_url=%2Fphotos%2Fatlantecostelegambiente%2Fsets%2F" + _selected.attributes.Flickr_Url + "%2Fshow%2F&page_show_back_url=%2Fphotos%2Fatlantecostelegambiente%2Fsets%2F" + _selected.attributes.Flickr_Url + "%2F&set_id=" + _selected.attributes.Flickr_Url + "&jump_to=\" width=\"640\" height=\"480\" /></object>";
        popup_html_model += "</div></div>";
    }
    else {
        if (_selected.attributes.Thumb_URL !== undefined && _selected.attributes.Thumb_URL != null && _selected.attributes.Thumb_URL != "" && _selected.attributes.Image_URL !== undefined && _selected.attributes.Image_URL != null && _selected.attributes.Image_URL != "") {
            popup_html_model += "<div class=\"mediaSection-popup\"> <div class=\"gallery\"> <div class=\"frame image\" dojoattachpoint=\"_mediaFrame\" style=\"-webkit-user-select: none;\"> <a target=\"_blank\" href=\"" + _selected.attributes.Image_URL + "\"> <img class=\"esriPopupMediaImage\" src=\"" + _selected.attributes.Thumb_URL + "\" style=\"margin-top: 8px;\"></a> </div> </div> </div>";
        }
    }
    if (_selected.attributes.City !== undefined && _selected.attributes.City != null && _selected.attributes.City != "")
        popup_html_model += "<div class=\"single-row\"> <b>Città:&nbsp;</b><br /> " + _selected.attributes.City + "</div><br />";
    if (_selected.attributes.Anagrafica !== undefined && _selected.attributes.Anagrafica != null && _selected.attributes.Anagrafica != "")
        popup_html_model += "<div class=\"single-row\"> <b>Anagrafica:&nbsp;</b><br /> " + _selected.attributes.Anagrafica + "</div><br />";
    if (_selected.attributes.Caratteris !== undefined && _selected.attributes.Caratteris != null && _selected.attributes.Caratteris != "")
        popup_html_model += "<div class=\"single-row\"> <b>Caratteristiche:&nbsp;</b><br /> " + _selected.attributes.Caratteris + "</div><br />";
    if (_selected.attributes.Natura_Imm !== undefined && _selected.attributes.Natura_Imm != null && _selected.attributes.Natura_Imm != "")
        popup_html_model += "<div class=\"single-row\"> <b>Natura immobile:&nbsp;</b><br /> " + _selected.attributes.Natura_Imm + "</div><br />";
    if (_selected.attributes.Vincoli_vi !== undefined && _selected.attributes.Vincoli_vi != null && _selected.attributes.Vincoli_vi != "")
        popup_html_model += "<div class=\"single-row\"> <b>Vincoli violati e motivazione di sequestro:&nbsp;</b><br /> " + _selected.attributes.Vincoli_vi + "</div><br />";
    if (_selected.attributes.Storia !== undefined && _selected.attributes.Storia != null && _selected.attributes.Storia != "")
        popup_html_model += "<div class=\"single-row\"> <b>Storia:&nbsp;</b><br /> " + _selected.attributes.Storia + "</div><br />";
    if (_selected.attributes.Documenti !== undefined && _selected.attributes.Documenti != null && _selected.attributes.Documenti != "")
        popup_html_model += "<div class=\"single-row\"> <b>Allegato:&nbsp;</b><a target=\"_blank\" class=\"scarica-documento\" href=\"" + _selected.attributes.Documenti + "\">Scarica il documento</a> </div><br />";
    popup_html_model += "<div style=\"clear: both;\"></div>"
    popup_html_model += "</div>";

    var window_html_model = "<div class=\"esriViewPopup\">";
    window_html_model += "<div class=\"mainSection\">";
    window_html_model += "<div class=\"header " + _selected.attributes.Tag + "\">" + _selected.attributes.Name + "</div> <div class=\"hzLine small-margin " + _selected.attributes.Tag + "\"></div>";
    window_html_model += "<button onclick=\"myDialog.show();\" class=\"" + _selected.attributes.Tag + "\">Visualizza tutte le informazioni</button><div style=\"clear:both;\"></div>";
    window_html_model += "<div>";
    if (_selected.attributes.Anagrafica !== undefined && _selected.attributes.Anagrafica != null && _selected.attributes.Anagrafica != "") {
        window_html_model += "<div class=\"single-row\"> <b>Anagrafica:&nbsp;</b><br /> " + _selected.attributes.Anagrafica + "</div>";
    }
    window_html_model += "<div class=\"break\"></div></div>";
    if (_selected.attributes.Flickr_Url !== undefined && _selected.attributes.Flickr_Url != null && _selected.attributes.Flickr_Url != "") {
        window_html_model += "<object width=\"420\" height=\"320\">";
        window_html_model += "<param name=\"flashvars\" value=\"offsite=true&lang=it-it&page_show_url=%2Fphotos%2Fatlantecostelegambiente%2Fsets%2F" + _selected.attributes.Flickr_Url + "%2Fshow%2F&page_show_back_url=%2Fphotos%2Fatlantecostelegambiente%2Fsets%2F" + _selected.attributes.Flickr_Url + "%2F&set_id=" + _selected.attributes.Flickr_Url + "&jump_to=\" />";
        window_html_model += "<param name=\"movie\" value=\"http://www.flickr.com/apps/slideshow/show.swf?v=140556 />";
        window_html_model += "<param name=\"allowFullScreen\" value=\"true\" />";
        window_html_model += "<embed type=\"application/x-shockwave-flash\" src=\"http://www.flickr.com/apps/slideshow/show.swf?v=140556\" allowfullscreen=\"true\" flashvars=\"offsite=true&lang=it-it&page_show_url=%2Fphotos%2Fatlantecostelegambiente%2Fsets%2F" + _selected.attributes.Flickr_Url + "%2Fshow%2F&page_show_back_url=%2Fphotos%2Fatlantecostelegambiente%2Fsets%2F" + _selected.attributes.Flickr_Url + "%2F&set_id=" + _selected.attributes.Flickr_Url + "&jump_to=\" width=\"420\" height=\"320\" /></object>";
    }
    else {
        if (_selected.attributes.Thumb_URL !== undefined && _selected.attributes.Thumb_URL != null && _selected.attributes.Thumb_URL != "" && _selected.attributes.Image_URL !== undefined && _selected.attributes.Image_URL != null && _selected.attributes.Image_URL != "") {
            window_html_model += "<div class=\"mediaSection\"> <div class=\"gallery\"> <div class=\"frame image\" dojoattachpoint=\"_mediaFrame\" style=\"-webkit-user-select: none;\"> <a target=\"_blank\" href=\"" + _selected.attributes.Image_URL + "\"> <img class=\"esriPopupMediaImage\" src=\"" + _selected.attributes.Thumb_URL + "\" style=\"margin-top: 8px;\"></a> </div> </div> </div>";
        }
    }
    window_html_model += "</div>";

    $("#info").html(window_html_model);

    $(".dijitDialogTitle").text(_selected.attributes.Name + " - Tutti i dettagli").attr("title", _selected.attributes.Name + " - Tutti i dettagli");
    $("#dijitDialogPaneContentArea").html(popup_html_model);
}

function onKeyDown(e) {

    if (!_selected) return;

    if ((e.keyCode != 38) && (e.keyCode != 40)) {
        return;
    }

    var index = $.inArray(_selected, _locations);
    index = (e.keyCode == 40) ? index + 1 : index - 1;
    if ((index > _locations.length - 1) || (index < 0)) return;

    preSelection();
    _selected = _locations[index];
    postSelection();
    highlightTab($("#thelist li").eq(index));
    scrollToPage(index);

}

function listItemClick(e) {

    if ($(this).find(".numberDiv").hasClass("selected") && (_currentState != STATE_TABLE)) {
        changeState(STATE_TABLE);
    } else {


        var index = $.inArray(this, $("#thelist li"));
        preSelection();
        _selected = _locations[index];
        //if (_counter == 0) switchMaps();
        postSelection();
        highlightTab(this);

        if (_currentState != STATE_INFO) changeState(STATE_INFO);

    }
}

function scrollToPage(index) {
    if (_scroll) {
        _scroll.scrollToPage(0, index, 500);
    } else {
        $("#thelist").animate({ scrollTop: (index * 41) }, 'slow');
    }
}

function pageDown() {
    var div = Math.floor($("#wrapper").height() / 41);
    if (_scroll) {
        _scroll.scrollTo(0, div * 41, 200, true);
    } else {
        var top = $("#thelist").scrollTop() + (div * 41);
        $("#thelist").animate({ scrollTop: top }, 'slow');
    }
}

function pageUp() {
    var div = Math.floor($("#wrapper").height() / 41);
    if (_scroll) {
        _scroll.scrollTo(0, -div * 41, 200, true);
    } else {
        var currentIndex = Math.floor($("#thelist").scrollTop() / 41);
        var newIndex = currentIndex - div;
        var top = newIndex * 41;
        $("#thelist").animate({ scrollTop: top }, 'slow');
    }
}

function reveal(retractIntro) {
    setTimeout(function () {
        $("#blot").animate({ left: 40 }, "slow", null, function () {
            _mapOV.resize();
            _mapSat.resize();
            $("#flipper").fadeIn("slow");
            transfer();
            if (retractIntro) $("#intro").animate({ left: 500 }, "slow");
        })
    }, 400);
}

function changeState(toState) {

    if (toState == STATE_TABLE) {
        if (_currentState == STATE_INTRO) {
            $("#intro").animate({ left: 500 }, "slow");
        } else if (_currentState == STATE_INFO) {
            $("#flipper").hide();
            $("#blot").animate({ left: $("#case").width() });
        } else if (_currentState == STATE_TABLE) {
            // redundant
        } else {
            throwStateException(_currentState);
        }
        $("#iconList").hide();
    } else if (toState == STATE_INFO) {
        if (_currentState == STATE_INTRO) {
            reveal(true);
        } else if (_currentState == STATE_TABLE) {
            reveal(false);
        } else if (_currentState == STATE_INFO) {
            // redundant
        } else {
            throwStateException(_currentState);
        }
        $("#iconLeft").hide();
        $("#iconList").show();
    } else if (toState == STATE_INTRO) {
        if (_currentState == STATE_TABLE) {
            $("#intro").animate({ left: 41 }, "slow");
        } else if (_currentState == STATE_INFO) {
            $("#intro").animate({ left: 41 }, "slow", function () {
                $("#blot").animate({ left: $("#case").width() });
            });
            $("#flipper").hide();
        } else if (_currentState == STATE_INTRO) {
            // redundant
        } else {
            throwStateException(_currentState)
        }
    } else {
        throwStateException(toState);
    }

    _currentState = toState;

}

function throwStateException(allegedState) {
    throw ("invalid state: ", allegedState);
}

function switchMaps() {

    var temp = _divMapRight;
    _divMapRight = _divMapLeft;
    _divMapLeft = temp;

    $(_divMapRight).detach();
    $(_divMapLeft).detach();

    $("#inner").append(_divMapLeft);
    $(_divMapRight).insertAfter($("#leftPane"));

    handleWindowResize();

    if (_selected) {
        setTimeout(function () {
            _mapSat.centerAt(_selected.geometry);
            _mapOV.centerAt(_selected.geometry);
            setTimeout(function () {
                moveGraphicToFront(_selected);
            }, 500);
        }, 500);
    }

}

function switchMapsFlip() {

    var temp = _divMapRight;
    _divMapRight = _divMapLeft;
    _divMapLeft = temp;

    $(_divMapRight).detach();
    $(_divMapLeft).detach();

    $("#inner").append(_divMapLeft);
    $(_divMapRight).insertAfter($("#leftPane"));

    handleWindowResizeFlip();

    if (_selected) {
        setTimeout(function () {
            _mapSat.centerAt(_selected.geometry);
            _mapOV.centerAt(_selected.geometry);
            setTimeout(function () {
                moveGraphicToFront(_selected);
            }, 500);
        }, 500);
    }

}

function loadList() {
    var iconEcomostriPath = "M52.042995,40.508999L52.042995,48.527 57.106998,48.527 57.106998,40.508999z M40.930999,40.508999L40.930999,48.527 45.994999,48.527 45.994999,40.508999z M29.818998,40.508999L29.818998,48.527 34.882999,48.527 34.882999,40.508999z M18.708,40.508999L18.708,48.527 23.771999,48.527 23.771999,40.508999z M52.042995,26.444L52.042995,34.461 57.106998,34.461 57.106998,26.444z M40.930999,26.444L40.930999,34.461 45.994999,34.461 45.994999,26.444z M29.818998,26.444L29.818998,34.461 34.882999,34.461 34.882999,26.444z M18.708,26.444L18.708,34.461 23.771999,34.461 23.771999,26.444z M7.5959998,26.444L7.5959998,34.461 12.66,34.461 12.66,26.444z M1.5480003,21.099001L63.437,21.099001 63.437,54.012999 12.66,54.012999 12.66,40.508999 7.5959998,40.508999 7.5959998,54.012999 1.5480003,54.012999z M49.793998,0L58.091999,0 58.091999,16.035 64,16.035 64,18.989 0,18.989 0,16.035 6.039426,16.035 19.271003,9.9870005 19.271003,15.837735 32.070991,9.9870005 32.070991,15.773616 44.728996,9.9870005 44.728996,16.035 49.793998,16.035z";
    var iconEcomostriColor = "#FF0000";
    var numDiv;
    var nameDiv;
    var li;
    var spec = _lutIconSpecs.normal;
    $.each(_locations, function (index, value) {
        switch (value.attributes.Tag) {
            case "Ecomostri":
                value.setSymbol(new esri.symbol.PictureMarkerSymbol(
			ICON_ECOMOSTRI_PREFIX + value.attributes.getValueCI(_configOptions.fieldName_Rank) + ICON_ECOMOSTRI_SUFFIX,
			spec.getWidth(),
			spec.getHeight()).setOffset(spec.getOffsetX(), spec.getOffsetY()));
                break;
            case "Spiagge":
                value.setSymbol(new esri.symbol.PictureMarkerSymbol(
			ICON_SPIAGGE_PREFIX + value.attributes.getValueCI(_configOptions.fieldName_Rank) + ICON_SPIAGGE_SUFFIX,
			spec.getWidth(),
			spec.getHeight()).setOffset(spec.getOffsetX(), spec.getOffsetY()));
                break;
            case "Paesaggi":
                value.setSymbol(new esri.symbol.PictureMarkerSymbol(
			ICON_PAESAGGI_PREFIX + value.attributes.getValueCI(_configOptions.fieldName_Rank) + ICON_PAESAGGI_SUFFIX,
			spec.getWidth(),
			spec.getHeight()).setOffset(spec.getOffsetX(), spec.getOffsetY()));
                break;
            default:
                value.setSymbol(new esri.symbol.PictureMarkerSymbol(
			ICON_UNKNOW_PREFIX + value.attributes.getValueCI(_configOptions.fieldName_Rank) + ICON_UNKNOW_SUFFIX,
			spec.getWidth(),
			spec.getHeight()).setOffset(spec.getOffsetX(), spec.getOffsetY()));
                break;
        }

        numDiv = $("<div class='numberDiv'>" + value.attributes.getValueCI(_configOptions.fieldName_Rank) + "</div>");
        $(numDiv).attr("title", "#" + value.attributes.getValueCI(_configOptions.fieldName_Rank) + ": " + value.attributes.getValueCI(_configOptions.fieldName_Name));
        nameDiv = $("<div class='nameDiv'><span style='margin-left:20px'>" + value.attributes.getValueCI(_configOptions.fieldName_Name) + "</span></div>");
        li = $("<li></li>");
        $(li).append(numDiv);
        $(li).append(nameDiv);
        $("#thelist").append(li);
    });
}

function createSymbol(path, color) {
    var markerSymbol = new esri.symbol.SimpleMarkerSymbol();
    markerSymbol.setPath(path);
    markerSymbol.setColor(new dojo.Color(color));
    markerSymbol.setOutline(null);
    return markerSymbol;
};

function highlightTab(tab) {
    $(tab).find(".numberDiv").addClass("selected");
    $(tab).find(".nameDiv").addClass("selected");
}

function layer_onClick(event) {
    $(".esriPopup").addClass("hideAll");
    preSelection();
    _selected = event.graphic;
    var index = $.inArray(_selected, _locations);
    highlightTab($("#thelist li").eq(index));
    scrollToPage(index);
    //if (_counter == 0) switchMaps();
    postSelection();
    if (_currentState != STATE_INFO) changeState(STATE_INFO);
}

function layer_onMouseOver(event) {
    if (_isMobile) return;
    var graphic = event.graphic;
    var spec = _lutIconSpecs.medium;
    if (graphic != _selected) {
        graphic.setSymbol(graphic.symbol.setHeight(spec.getHeight()).setWidth(spec.getWidth()).setOffset(spec.getOffsetX(), spec.getOffsetY()));
    }
    if (!_isIE) moveGraphicToFront(graphic);
    _mapOV.setMapCursor("pointer");
    $("#hoverInfo").html(graphic.attributes.getValueCI(_configOptions.fieldName_Name));
    var pt = _mapOV.toScreen(graphic.geometry);
    hoverInfoPos(pt.x, pt.y);
}

function layer_onMouseOut(event) {
    _mapOV.setMapCursor("default");
    $("#hoverInfo").hide();
    var graphic = event.graphic;
    var spec = _lutIconSpecs.normal;
    if (graphic != _selected) {
        graphic.setSymbol(graphic.symbol.setHeight(spec.getHeight()).setWidth(spec.getWidth()).setOffset(spec.getOffsetX(), spec.getOffsetY()));
    }
}

function layer_onFlickr(event) {
    _mapOV.infoWindow.show(event.screenPoint);
    $(".esriPopup").removeClass("hideAll");
    var layer = _mapOV.getLayer("mapOV_graphics");
    window.myfeaturesfound = [];
    for (var i = 0; i < layer.graphics.length; i++) {
        if (layer.graphics[i].geometry.x == event.graphic.geometry.x && layer.graphics[i].geometry.y == event.graphic.geometry.y) {
            window.myfeaturesfound.push(layer.graphics[i]);
        }
    }
}

function checkinfoshow() {
    if (window.myfeaturesfound && window.myfeaturesfound.length > 0) {
        var t = window.myfeaturesfound;
        window.myfeaturesfound = [];
        for (var i = 0; i < t.length; i++) {
            _mapOV.infoWindow.setFeatures(t);
            //_mapOV.infoWindow.features.push(t[i]);
        }
    }
}

function addPopupFlickr(event, content) {
    _mapOV.infoWindow.setTitle(content.attributes.title);
    _mapOV.infoWindow.setContent("<img src=\"" + content.attributes.url_s + "\"");
    _mapOV.infoWindow.show(event.screenPoint, _mapOV.getInfoWindowAnchor(event.screenPoint));
}

function layer_onClickRegione(event) {
    //_selectedRegione = event.graphic;
    //var arr = $.grep(_sourceRegioniLayer.graphics, function (n, i) {
    //    return n.attributes.NOME_REG == _selectedRegione.attributes.NOME_REG;
    //});

    //var popup_html = "<div class=\"esriPopupWrapper\" style=\"position: absolute; left: 16px; top: -86px;\">";
    //popup_html += "<div class=\"sizer\">";
    //popup_html += "<div class=\"titlePane\" style=\"-webkit-user-select: none;\">";
    //popup_html += "<div class=\"spinner hidden\" title=\"Ricerca in corso......\"></div>";
    //popup_html += "<div class=\"title\">&nbsp;</div>";
    //popup_html += "<div class=\"titleButton close\" onclick=\"closePopup();\" title=\"Chiudi\"></div>";
    //popup_html += "</div>";
    //popup_html += "</div>";
    //popup_html += "<div class=\"sizer content\">";
    //popup_html += "<div class=\"contentPane\">";
    //popup_html += "<div class=\"esriViewPopup\" id=\"esri_dijit__PopupRenderer_1\" widgetid=\"esri_dijit__PopupRenderer_1\">";
    //popup_html += "<div class=\"mainSection\">";
    //popup_html += "<div class=\"header\" dojoattachpoint=\"_title\">" + _selectedRegione.attributes.NOME_REG + "</div>";
    //popup_html += "<div class=\"hzLine\"></div>";
    //popup_html += "<div dojoattachpoint=\"_description\">";
    //popup_html += "<table class=\"attrTable\" cellpadding=\"0px\" cellspacing=\"0px\">";
    //popup_html += "<tbody>";
    //if (_selectedRegione.attributes.LINK_1 !== undefined && _selectedRegione.attributes.LINK_1 != null && _selectedRegione.attributes.LINK_1 != "") {
    //    popup_html += "<tr valign=\"top\">";
    //    popup_html += "<td class=\"attrName\">Dossier Regionale</td>";
    //    popup_html += "<td class=\"attrValue\"><a target=\"_blank\" href=\"" + _selectedRegione.attributes.LINK_1 + "\" title=\"Visualizza maggiori informazioni\">Altre informazioni</a></td>";
    //    popup_html += "</tr>";
    //}
    //if (_selectedRegione.attributes.LINK_2 !== undefined && _selectedRegione.attributes.LINK_2 != null && _selectedRegione.attributes.LINK_2 != "") {
    //    popup_html += "<tr valign=\"top\">";
    //    popup_html += "<td class=\"attrName\">Dossier Italia</td>";
    //    popup_html += "<td class=\"attrValue\"><a target=\"_blank\" href=\"" + _selectedRegione.attributes.LINK_2 + "\" title=\"Visualizza maggiori informazioni\">Altre informazioni</a></td>";
    //    popup_html += "</tr>";
    //}
    //popup_html += "</tbody>";
    //popup_html += "</table>";
    //popup_html += "</div>";
    //popup_html += "<div class=\"break\"></div>";
    //popup_html += "</div>";
    //popup_html += "</div>";
    //popup_html += "</div>";
    //popup_html += "</div>";
    //popup_html += "</div>";

    //$(".esriPopup").html(popup_html);
    _mapOV.infoWindow.show(event.screenPoint);
    $(".esriPopup").removeClass("hideAll");
}

function closePopup() {
    $(".esriPopup").addClass("hideAll");
    $(".hoverInfo").removeClass("hideAll");
}

function layer_onMouseOverRegione(event) {
    if (_isMobile) return;
    var graphic = event.graphic;
    if (!_isIE) moveGraphicToFront(graphic);
    _mapOV.setMapCursor("pointer");

    $("#hoverInfo").html("<span style=\"font-size:14px; margin-bottom: 4px;\">" + graphic.attributes.NOME_REG + "</span><br/><span style=\"font-weight:bold;\">Fai click sulla regione per scaricare i documenti allegati</span>");
    var pt = _mapOV.toScreen(graphic.geometry.getExtent().getCenter());
    hoverInfoPos(pt.x, pt.y);
}

function layer_onMouseOutRegione(event) {
    _mapOV.setMapCursor("default");
    $("#hoverInfo").hide();
}

function handleWindowResize() {

    if (($("body").height() <= 600) || ($("body").width() <= 1000)) $("#header").height(0);
    else $("#header").height(115);

    $("#leftPane").height($("body").height() - $("#header").height());
    $("#leftPane").width(parseInt($("body").width() * .5));
    if ($("#leftPane").width() > 500) $("#leftPane").width(500);

    $("#case").height($("#leftPane").height());

    $("#table").height($("#case").height());
    $("#table #wrapper .nameDiv").width($("#leftPane").width() - $("#table #wrapper .numberDiv").width());

    $("#table #wrapper").height($("#case").height() - $("#table #topRow").height() - $("#table #bottomRow").height() - 2);
    $("#blot").width($("#leftPane").width() - 40);
    $("#table #topRow").width($("#leftPane").width() - 2);
    $("#table #bottomRow").width($("#leftPane").width() - 2);
    $("#blot").height($("#leftPane").height() - $("#table #topRow").height() - 21);
    $("#case #blot").css("left", $("#leftPane").width());


    $("#intro").width($("#leftPane").width() - 70);
    $("#intro").height($("#leftPane").height());

    $(_divMapRight).height($("body").height() - $("#header").height());
    $(_divMapRight).width($("body").width() - $("#leftPane").outerWidth());
    $(_divMapRight).css("left", $("#leftPane").outerWidth());
    $(_divMapRight).css("top", $("#header").outerHeight());

    $("#blot #inner").height($("#blot").height() - (parseInt($("#blot #inner").css("margin-top")) + parseInt($("#blot #inner").css("margin-bottom"))));

    $(_divMapLeft).width($("#blot #inner").width());
    $(_divMapLeft).height($("#blot #inner").height() - ($("#blot #info").height() + parseInt($("#blot #inner").css("margin-top"))));
    $(_divMapLeft).css("top", $("#blot #info").outerHeight());
    $(_divMapLeft).css("left", 0);

    $("#flipper").css("top", $("#info").height() + ($(_divMapLeft).height() / 2) + ($("#flipper").height() / 2));

    if (!_scroll) {
        $("#thelist").height($("#wrapper").height());
    }

    if (_mapSat) _mapSat.resize();
    if (_mapOV) _mapOV.resize();

}

function handleWindowResizeFlip() {

    if (($("body").height() <= 600) || ($("body").width() <= 1000)) $("#header").height(0);
    else $("#header").height(115);

    $("#leftPane").height($("body").height() - $("#header").height());
    $("#leftPane").width(parseInt($("body").width() * .5));
    if ($("#leftPane").width() > 500) $("#leftPane").width(500);

    $("#case").height($("#leftPane").height());

    $("#table").height($("#case").height());
    $("#table #wrapper .nameDiv").width($("#leftPane").width() - $("#table #wrapper .numberDiv").width());

    $("#table #wrapper").height($("#case").height() - $("#table #topRow").height() - $("#table #bottomRow").height() - 3);
    $("#blot").width($("#leftPane").width() - 40);
    $("#table #topRow").width($("#leftPane").width() - 2);
    $("#table #bottomRow").width($("#leftPane").width() - 2);
    $("#blot").height($("#leftPane").height() - $("#table #topRow").height() - 21);


    $("#intro").width($("#leftPane").width() - 70);
    $("#intro").height($("#leftPane").height());

    $(_divMapRight).height($("body").height() - $("#header").height());
    $(_divMapRight).width($("body").width() - $("#leftPane").outerWidth());
    $(_divMapRight).css("left", $("#leftPane").outerWidth());
    $(_divMapRight).css("top", $("#header").outerHeight());

    $("#blot #inner").height($("#blot").height() - (parseInt($("#blot #inner").css("margin-top")) + parseInt($("#blot #inner").css("margin-bottom"))));

    $(_divMapLeft).width($("#blot #inner").width());
    $(_divMapLeft).height($("#blot #inner").height() - ($("#blot #info").height() + parseInt($("#blot #inner").css("margin-top"))));
    $(_divMapLeft).css("top", $("#blot #info").outerHeight());
    $(_divMapLeft).css("left", 0);

    $("#flipper").css("top", $("#info").height() + ($(_divMapLeft).height() / 2) + ($("#flipper").height() / 2));

    //if (!_scroll) {
    //    $("#thelist").height($("#wrapper").height());
    //}

    if (_mapSat) _mapSat.resize();
    if (_mapOV) _mapOV.resize();

}

function preSelection() {

    // return the soon-to-be formerly selected graphic icon to normal
    // size; also remove highlight from table record.
    if (_selected) {
        $("li .nameDiv").removeClass("selected");
        $("li .numberDiv").removeClass("selected");
        var height = _lutIconSpecs["normal"].getHeight();
        var width = _lutIconSpecs["normal"].getWidth();
        var offset_x = _lutIconSpecs["normal"].getOffsetX()
        var offset_y = _lutIconSpecs["normal"].getOffsetY();

        var url = ICON_UNKNOW_PREFIX + _selected.attributes.getValueCI(_configOptions.fieldName_Rank) + ICON_UNKNOW_SUFFIX;
        switch (_selected.attributes.Tag) {
            case "Ecomostri":
                var url = ICON_ECOMOSTRI_PREFIX + _selected.attributes.getValueCI(_configOptions.fieldName_Rank) + ICON_ECOMOSTRI_SUFFIX;
                break;
            case "Spiagge":
                var url = ICON_SPIAGGE_PREFIX + _selected.attributes.getValueCI(_configOptions.fieldName_Rank) + ICON_SPIAGGE_SUFFIX;
                break;
            case "Paesaggi":
                var url = ICON_PAESAGGI_PREFIX + _selected.attributes.getValueCI(_configOptions.fieldName_Rank) + ICON_PAESAGGI_SUFFIX;
                break;
        }
        _selected.setSymbol(_selected.symbol.setHeight(height).setWidth(width).setOffset(offset_x, offset_y).setUrl(url));
    }

}

function postSelection() {

    // center to selected location, and zoom, if appropriate.
    var level = _selected.attributes.getValueCI(_configOptions.fieldName_Level);
    if (!level) level = _configOptions.defaultLargeScaleZoomLevel;
    if (_isIE) {
        // using work-around for IE, because centerAndZoom seems to have
        // issues when panning over large distances
        specialCenterAndZoom(_mapSat, _selected.geometry, level);
    } else {
        // not really sure it's necessary to distinguish between 
        // centerAt and centerAndZoom.  pretty sure I could get by
        // with just centerAndZoom, but just in case centerAt is more
        // fluid, I will provide the option.
        if (level == _mapSat.getLevel()) {
            _mapSat.centerAt(_selected.geometry)
        } else {
            _mapSat.centerAndZoom(_selected.geometry, level)
        }
    }

    // make the selected location's icon BIG
    var height = _lutIconSpecs["large"].getHeight();
    var width = _lutIconSpecs["large"].getWidth();
    var offset_x = _lutIconSpecs["large"].getOffsetX()
    var offset_y = _lutIconSpecs["large"].getOffsetY();

    var url = ICON_UNKNOW_PREFIX + _selected.attributes.getValueCI(_configOptions.fieldName_Rank) + ICON_UNKNOW_SUFFIX;
    switch (_selected.attributes.Tag) {
        case "Ecomostri":
            var url = ICON_ECOMOSTRI_PREFIX + _selected.attributes.getValueCI(_configOptions.fieldName_Rank) + ICON_ECOMOSTRI_SUFFIX;
            break;
        case "Spiagge":
            var url = ICON_SPIAGGE_PREFIX + _selected.attributes.getValueCI(_configOptions.fieldName_Rank) + ICON_SPIAGGE_SUFFIX;
            break;
        case "Paesaggi":
            var url = ICON_PAESAGGI_PREFIX + _selected.attributes.getValueCI(_configOptions.fieldName_Rank) + ICON_PAESAGGI_SUFFIX;
            break;
    }
    _selected.setSymbol(_selected.symbol.setHeight(height).setWidth(width).setOffset(offset_x, offset_y).setUrl(url));

    transfer();

    _counter++;

    setTimeout(function () {
        _mapOV.centerAt(_selected.geometry);
        setTimeout(function () {
            moveGraphicToFront(_selected);
        }, 500)
    }, 500);
}

function hoverInfoPos(x, y) {
    if (x <= ($("#map").width()) - 230) {
        $("#hoverInfo").css("left", x + 15);
    }
    else {
        $("#hoverInfo").css("left", x - 25 - ($("#hoverInfo").width()));
    }
    if (y >= ($("#hoverInfo").height()) + 50) {
        $("#hoverInfo").css("top", y - 35 - ($("#hoverInfo").height()));
    }
    else {
        $("#hoverInfo").css("top", y - 15 + ($("#hoverInfo").height()));
    }
    $("#hoverInfo").show();
}

function getValueCI(field) {
    var found;
    $.each(this, function (index, value) {
        if (index.toUpperCase() == field.toUpperCase()) {
            found = index;
            return false;
        }
    });
    return this[found];
}

function compare(a, b) {
    rank_a = parseInt(a.attributes.getValueCI(_configOptions.fieldName_Rank));
    rank_b = parseInt(b.attributes.getValueCI(_configOptions.fieldName_Rank));
    if (rank_a < rank_b) return -1;
    else if (rank_a == rank_b) return 0;
    else return 1;
}

function specialCenterAndZoom(map, center, level) {

    /* this function is a work-around to using centerAt() at large extents.
    there seems to be a bug whereby the map fetches unneccesary tiles
    on centerAt(), so we need to make sure to turn off layers (and zoom out?)
    before re-centering */

    // which layers are visible?

    var visibleLayers = [];

    $.each(map.layerIds, function (index, value) {
        if (map.getLayer(value).visible) visibleLayers.push(value);
    });

    $.each(map.graphicsLayerIds, function (index, value) {
        if (map.getLayer(value).visible) visibleLayers.push(value);
    });

    // turn off visible layers

    $.each(visibleLayers, function (index, value) {
        map.getLayer(value).hide();
    });

    map.setLevel(3);
    setTimeout(function () {
        map.centerAt(center);
        setTimeout(function () {
            map.setLevel(level);
            map.centerAt(center);
            setTimeout(function () {
                // turn visible layers back on
                $.each(visibleLayers, function (index, value) {
                    map.getLayer(value).show();
                });
            }, 200);
        }, 200);
    }, 200)
}

function checkFlickrPhotos(id, key) {
    if ($("#" + id).hasClass("mode-on")) {
        cleanFlickr(key);
        $("#" + id).removeClass("mode-on");
    }
    else {
        switch (key) {
            case "Spiagge":
                loadPhotos("spiaggeatlantecoste2014", key);
                break;
            case "Ecomostri":
                loadPhotos("ecomostriatlantecoste2014", key);
                break;
            case "Paesaggi":
                loadPhotos("paesaggitrasformatiatlantecoste2014", key);
                break;

        }
        $("#" + id).addClass("mode-on");
    }
}

//START - CODICE FLICKR
function cleanFlickr(key) {
    var Layer = _mapOV.getLayer("mapOV_graphics");
    if (Layer !== undefined) {
        for (var i = Layer.graphics.length - 1; i >= 0; i--) {
            if (Layer.graphics[i].type === "flickr_" + key) {
                Layer.remove(Layer.graphics[i]);
            }
        }
    }
};

function loadPhotos(words, key) {
    var flickrPhotos = esri.request({
        url: "https://secure.flickr.com/services/rest/?extras=description%2C%20date_upload%2C%20owner_name%2C%20geo%2C%20url_s&per_page=200&sort=date-posted-desc&safe_search=2&content_type=7&user_id=78779397@N04&method=flickr.photos.search&api_key=f76fc00412cdc74022cf08d403bc505f&has_geo=1&page=0",
        content: {
            format: "json",
            tagmode: "any",
            tags: words//il testo inserito nella ricerca
        },
        callbackParamName: "jsoncallback"
    });
    flickrPhotos.then(
	  function (data) {
	      addPhotos(data, key);
	  },
	  function (error) {
	      console.log("Error: ", error.message);
	  });
};

function addPhotos(data, key) {
    if (!data) {
        myDialog = new Dialog({
            title: "Ricerca su Flickr",
            content: "Verifica la tua connessione",
            style: "width: 400px"
        });
        myDialog.show();
        return;
    }
    var Layer = _mapOV.getLayer("mapOV_graphics");

    for (var i = Layer.graphics.length - 1; i >= 0; i--) {
        if (Layer.graphics[i].type === "flickr_" + key) {
            Layer.remove(Layer.graphics[i]);
        }
    }

    var symbol = new esri.symbol.PictureMarkerSymbol("resources/icons/flickr_icon_" + key + ".png", 24, 17);
    var template = new esri.dijit.PopupTemplate({
        title: "{title}",
        description: "<p><a href=\"http://www.flickr.com/people/atlantecostelegambiente/\">{ownername}<\/a> ha aggiunto questa foto:<\/p> <p><a href=\"http://www.flickr.com/photos/atlantecostelegambiente/{id}/\" title=\"{title}\"><img src=\"{url_s}\" width=\"{width_s}\" height=\"{height_s}\" alt=\"{title}\" /><\/a><\/p>"
    });


    dojo.forEach(data.photos.photo, function (item) {
        var loc = new esri.geometry.Point(item.longitude, item.latitude);
        var graphic = new esri.Graphic(loc, symbol, item, template);
        graphic.type = "flickr_" + key;
        _mapOV.graphics.add(graphic);
    });

    Layer.show();

    var count = 0;
    for (var i = 0; i < Layer.graphics.length; i++) {
        if (Layer.graphics[i].type === "flickr_" + key) {
            count++;
        }
    }

    if (count != 0) {
        Layer.show();
        //var xmin, ymin, xmax, ymax;
        //var xmin = Enumerable.From(Layer.graphics)
        //                    .Where(function (gg) { return gg._extent.xmin != 0 && gg._extent.ymin != 0 && gg._extent.xmax != 0 && gg._extent.ymax != 0; })
        //                    .Min(function (gg) { return gg._extent.xmin; });

        //var ymin = Enumerable.From(Layer.graphics)
        //                    .Where(function (gg) { return gg._extent.xmin != 0 && gg._extent.ymin != 0 && gg._extent.xmax != 0 && gg._extent.ymax != 0; })
        //                    .Min(function (gg) { return gg._extent.ymin; });

        //var xmax = Enumerable.From(Layer.graphics)
        //                    .Where(function (gg) { return gg._extent.xmin != 0 && gg._extent.ymin != 0 && gg._extent.xmax != 0 && gg._extent.ymax != 0; })
        //                    .Max(function (gg) { return gg._extent.xmax; });

        //var ymax = Enumerable.From(Layer.graphics)
        //                    .Where(function (gg) { return gg._extent.xmin != 0 && gg._extent.ymin != 0 && gg._extent.xmax != 0 && gg._extent.ymax != 0; })
        //                    .Max(function (gg) { return gg._extent.ymax; });

        //var extent = new esri.geometry.Extent(xmin, ymin, xmax, ymax, new esri.SpatialReference({ wkid: 4326 }));
        //_mapOV.setExtent(extent);
    }
}
//END - CODICE FLICKR