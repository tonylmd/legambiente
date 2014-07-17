function LocationsParserService() {

	var FIELDNAME_NAME = "port";
	var FIELDNAME_COUNTRY = "country";
	var FIELDNAME_RANK = "rank";

	// **********
	// methods...
	// **********

	this.process = function(source, callBack) {
		var arr = [];
				
		$(source).each(function(index, element) {
			
		   arr.push(new esri.Graphic(
				new esri.geometry.Point(element.geometry.x, element.geometry.y, element.geometry.spatialReference),
				null,
				new PortAttributes(
					getValueCI(element.attributes, FIELDNAME_NAME), 
					getValueCI(element.attributes, FIELDNAME_RANK), 
					getValueCI(element.attributes, FIELDNAME_COUNTRY)
				)
			));
		   
		});	
	
		arr.sort(compare);	
		callBack(arr);
		
	}
	
	function compare(a,b) {
		rank_a = parseInt(a.attributes.getRank());
		rank_b = parseInt(b.attributes.getRank());
		if (rank_a < rank_b) return -1;
		else if (rank_a == rank_b) return 0;
		else return 1;
	}	

	
	// ********************
	// private functions...
	// ********************
	

	function getValueCI(obj,field) {
		var found;
		$.each(obj,function(index,value){
			if (index.toUpperCase() == field.toUpperCase()) {
				found = index;
				return false;
			}
		});
		return obj[found];	
	}	
	
}

