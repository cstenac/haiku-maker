haiku = require("./haiku.js")

var hm = new haiku.HaikuMaker()
hm.vocabulary = haiku.dataVocabulary;

//for (var i = 0; i < 10 ; i++) {
	//console.info(hm.conjClause().toString())
//}

console.info(hm.makeStr());
