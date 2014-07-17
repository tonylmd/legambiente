function PortAttributes(name, rank, country)
{
	var _name = name;
	var _rank = rank;
	var _country = country;
	
	this.getName = function() 
	{
		return _name;
	}
	
	this.getRank = function()
	{
		return _rank;
	}
	
	this.getCountry = function()
	{
		return _country;
	}
	
}