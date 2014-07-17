_configOptions = {
	
	//Enter a title, if no title is specified, the webmap's title is used.
	//title should be readable from ArcGIS.com viewer TOC
	//title: "Your title here",
	
	//Enter a subtitle, if not specified the ArcGIS.com web map's summary is used
	//subtitle: "Your subtitle here",
	
	//id for satellite (or intended large scale) web map
	webmap_largescale: "f1c9de26313e4b8a9aeb25b6fd5ba218", 
	
	//id for overview web map; this is the map that contains the content point layer
	webmap_overview: "f1c9de26313e4b8a9aeb25b6fd5ba218",
		
	//layer in overview webmap which provides the countdown content
	contentLayer: "paesaggi", 
    // contentRegioniLayer: "regioni", 
	fieldName_Rank: "rank",
	fieldName_Name: "name",
	//NOTE: if level field doesn't exist, app will use defaultLargeScaleZoomLevel
	fieldName_Level: "level",

	//Initial zoom level for overview map
	initialZoomLevel: 7,
	
	//Initial overview map zoom level for wider map aspect ratios
	initialZoomLevelWide: 7,
	
	//If no zoom level is encoded for the feature, use this zoom 
	//level for the large scale map
	defaultLargeScaleZoomLevel: 18,
	
	showIntro: true,
	popupHeight: 450,
	popupLeftMargin: 12
}
