(function(){

/* ********************************************
 * The Stream represents a sentence being built
 * ********************************************/

function Stream(){
	this.len = 0;
	this.toks = [];
}

Stream.prototype.addToken = function(token) {
	this.len += token.len;
	this.toks.push(token);
}

Stream.prototype.comma = function(){
	this.addToken({ w : ",", len : 0})
}

Stream.prototype.append = function(other) {
	if  (!other.toks) throw Exception("oops");
	this.len += other.len;
	this.toks = this.toks.concat(other.toks);
}

Stream.prototype.toString = function(){
	var s = "";
	//console.info("ts", this.toks);
	for (var i = 0; i < this.toks.length; i++) {
		if (i > 0 && this.toks[i].w != ",") {
			s+= " ";
		}
		s += this.toks[i].w;
	}
	return s;
}

Stream.prototype.dup = function(){
	var s2 = new Stream();
	s2.toks = JSON.parse(JSON.stringify(this.toks));
	s2.len = this.len
	return s2;
}


/* If the stream is splittable at "point", returns
 * an array of 2 streams, else returns null */
Stream.prototype.trySplit = function(point) {
	var cum = 0;
	for (var i = 0; i < this.toks.length; i++) {
		cum += this.toks[i].len;
		if (cum > point) return null;
		if (cum == point) {
			var s1 = new Stream();
			var s2 = new Stream();
			for (var j = 0; j <= i; j++) {
				s1.addToken(this.toks[j]);
			}
			// Attach commas on the first sentence
			if (this.toks[i+1].w == ",") {
				s1.comma();
				i++;
			}
			for (var j = i + 1; j < this.toks.length; j++) {
				s2.addToken(this.toks[j]);
			}
			return [s1, s2];
		}
	}
}

function tok(w, l) {
	return { w : w, len : l }
}

// Min and max inclusive
function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/* ********************************************
 * Main builder
 * ********************************************/

function HaikuMaker() {
}

HaikuMaker.prototype.lowProba = function(){
	return Math.random() > 0.8;
}
HaikuMaker.prototype.medProba = function(){
	return Math.random() > 0.5;
}
HaikuMaker.prototype.randToken = function(clazz) {
	var c = this.vocabulary[clazz];
	var r = parseInt(Math.random() * c.length);
	return c[r];
}

HaikuMaker.prototype.sentence = function(len){
	// Sentence:
	//   conjClause [conj conjClause]
	//console.info("Make sentence " + len);
	while (true){
		var s = this.conjClause()
		//console.info(s);
		//console.info(" --> " + s.toString() + " (" + s.len + ")")
		if (s.len  == len) {
			return s;
		} else if (s.len > len) {
			continue;
		} else if (len - s.len >= 2) {
			var s2 = new Stream();
			// We have room for another one !
			s2.addToken(this.randToken("conjunction"));
			s2.append(this.conjClause());
			if (s.len + s2.len == len) {
				s.comma();
				s.append(s2);
				return s;
			}
		}
	}
}
HaikuMaker.prototype.conjClause = function(){
	/* Conj clause:
	 *   <noun clause><intransitive verb>
	 *   <noun clause><transitive verb><noun clause>
	 *
	 * Also:
	 *   - Adverb can come before noun, after noun
	 *   - complement can come after intransitive verb
	 */

	var adverb = false;
	var adverbLoc = 0; // 0: before noun, 1: after noun, before verb, 2: after verb
	var s = new Stream();

	if (this.medProba()) {
		adverb = true;
		adverbLoc = randInt(0, 2)
	}

	var type = Math.random();
	var plural = this.medProba();

	if (type < 0.5) { // intransitive
		if (adverb && adverbLoc == 0) {
			s.addToken(this.randToken("adverb"));
		}
		s.append(this.nounClause(plural));
		if (adverb && adverbLoc == 1) {
			s.addToken(this.randToken("adverb"));
		}

		var verb = this.randToken("intransitive_verb");
		if (!plural) {
			verb = tok(verb.w + "s", verb.len);
		}
		s.addToken(verb);

		if (adverb && adverbLoc == 2) {
			s.addToken(this.randToken("adverb"));
		}

		if (this.lowProba()) { // Add a complement
			s.addToken(this.randToken("preposition"))
			s.append(this.nounClause());
		}
	} else {
		if (adverb && adverbLoc == 0) {
			s.addToken(this.randToken("adverb"));
		}

		s.append(this.nounClause(plural));
		if (adverb && adverbLoc == 1) {
			s.addToken(this.randToken("adverb"));
		}

		var verb = this.randToken("transitive_verb");
		if (!plural) {
			verb = tok(verb.w + "s", verb.len);
		}
		//console.info("   PLURAL " + plural + " N " + s.toString() + " VERB " + verb.w);
		s.addToken(verb);

		if (adverb && adverbLoc == 2) {
			s.addToken(this.randToken("adverb"));
		}

		s.append(this.nounClause());
	}
	return s;
}


HaikuMaker.prototype.nounClause = function(plural){
	/* Noun clause:
	 *  [Article] [adjective] noun
	 */
	 var s = new Stream();

	 if (!plural) {
	 	s.addToken(this.randToken("article_s"));
	 } else {
	 	// Plural article only in some cases
	 	if (this.medProba()) {
	 		s.addToken(this.randToken("article_p"));
	 	}
	 }

	 if (this.medProba()) {
	 	s.addToken(this.randToken("adjective"));
	 }
	 if (plural) {
	 	s.addToken(this.randToken("noun_p"));
	 } else {
	 	s.addToken(this.randToken("noun_s"));
	 }
	 return s;
}

/** Entry point to build a Haiku */
HaikuMaker.prototype.make = function(){
	/* Either: (5, 7, 5) or (5, 12 (splitted)) or (12 (splitted), 5) */

	if (this.medProba()){
		while (true) {
			//console.info("SPLIT1");
			var long1 = this.sentence(12);
			var arr = long1.trySplit(5);
			if (!arr) continue;
			//	console.info("SPLITTABLE ", long1.toString(), "-->", JSON.stringify(arr));

			var end = this.sentence(5);
			return [arr[0], arr[1], end];
		}
	} else if (this.lowProba()) {
		while (true) {
			var long1 = this.sentence(12);
			var arr = long1.trySplit(5);
			if (!arr) continue;
			var beg = this.sentence(5);
			return [beg, arr[0], arr[1]];
		}
	} else {
		return [this.sentence(5), this.sentence(7), this.sentence(5)];
	}
}

HaikuMaker.prototype.makeStr = function(){
	var haiku = this.make();
	return haiku[0].toString() + "\n" + haiku[1].toString() + "\n" + haiku[2];
}



exports.dataVocabulary = {
	"noun_s" : [
		// Purely data
		tok("data", 1),
		tok("flow", 1),
		tok("cloud", 1),
		tok("tree", 1),
		tok("graph", 1),
		tok("schema", 2),
		tok("lake", 1),
		tok("relation", 3),
		tok("network", 2),

		// Misc
		tok("zoo", 1),
		tok("joy", 1),
		tok("smoke", 1),
		tok("heat", 1),
		tok("insight", 2),

		// Tradictional
		tok("winter", 2), tok("summer", 2), tok("spring", 1), tok("autumn", 2),
		tok("mountain", 2),
		tok("wind", 1),
		tok("bay", 1)
	],
	"noun_p" : [
		// Purely data
		tok("flows", 1),
		tok("clouds", 1),
		tok("trees", 1),
		tok("graphs", 1),
		tok("schemas", 2),
		tok("lakes", 1),
		tok("relations", 3),
		tok("networks", 2),

		// Misc
		tok("zoos", 1),
		tok("workers", 2),
		tok("rows", 1),
		tok("insights", 2)
	],
	"adverb" : [
		tok("quickly", 2),
		tok("peacefully", 3),
		tok("calmly", 2),
		tok("precisely", 3),
		tok("quietly", 2),
		tok("strangely", 2),
		tok("")
	],
	"adjective" : [
		tok("big", 1),
		tok("peaceful", 2),
		tok("exciting", 3),
		tok("young", 1),
		tok("old", 1),
		tok("green", 1),
		tok("small", 1),
		tok("empty", 2),
		tok("full", 1),
		tok("nameless", 2),
		tok("complex", 2),
		tok("larger", 2),
	],
	"preposition" : [
		tok("in", 1),
		tok("out", 1),
		tok("under", 2),
		tok("above", 2),
		tok("to", 1),
		tok("at", 1),
		tok("before", 2),
		tok("after", 2)
	],
	"intransitive_verb" : [
		tok("flow", 1),
		tok("code", 1),
		tok("play", 1),
		tok("work", 1),
		tok("turn", 1),
		tok("jump", 1),
		tok("walk", 1),
		tok("grow", 1),
		tok("rain", 1),
		tok("shine", 1)
	],
	"transitive_verb" :[
		tok("twist", 1),
		tok("love", 1),
		tok("hate", 1),
		tok("stop", 1),
		tok("kill", 1),
		tok("bend", 1),
		tok("call", 1),
		tok("analyse", 3),
		tok("watch", 1)
	],
	"conjunction" : [
		tok("and", 1),
		tok("and", 1),
		tok("and", 1),
		tok("or", 1),
		tok("but", 1),
		tok("but", 1),
		tok("yet", 1)
	],
	"article_s": [
		tok("the", 1),
		tok("the", 1),
		tok("the", 1),
		tok("a", 1),
		tok("a", 1),
		tok("this", 1),
		tok("that", 1),
		tok("no", 1)
	],
	"article_p": [
		tok("many", 1),
		tok("few", 1),
		tok("these", 1),
		tok("those", 1)
	]
}

if (typeof window !== 'undefined' && window) {
	window.HaikuMaker = HaikuMaker;
} else if (typeof exports !== 'undefined' && exports) {
	exports.HaikuMaker = HaikuMaker;
}

})();