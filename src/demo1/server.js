var boxes = '-18.16,27.63,-13.4,30.0,-7.523,36.0,-1.6274,38.7289,-7.5416,37.35,4.33,40.48,-7.08,40.48,4.33,41.807,-9.3,41.807,-0.73,43.8,-0.73,41.807,3.34,43.0,-2.9755,35.2560,-2.91,35.337,-5.3822,35.8715,-5.2783,35.9180';

var keywords = 'unizar,@unizar,#unizar,zaragoza,bifi,ibercivis,iberus,chema gimeno,manolo lopez,universidad de zaragoza';
var users = '';

var asincrono = require('async');
var util = require('util');
var twitter = require('immortal-ntwitter');
var fs = require('fs');
var orient = require("orientdb");
var Db = orient.Db;
var Server = orient.Server;

var dbConfig = {
    user_name: "admin",
    user_password: "admin"
};

var serverConfig = {
    host: "localhost",
    port: 2424,
    user_name: "root",
    user_password: "208812227EDB54ACFCB55B8D7FF9ABA0B8B4526F7B3276A3F4360DA26BD6E4E9"
};

var server = new Server(serverConfig);
var db = new Db("../databases/twzaragoza", server, dbConfig);
//al que se le ocurrio que Uppercase/Lowercase era una buena manera de
//distinguir variables y creadores, tendrian que colgarlo -- AR


var tweet = twitter.create({
    consumer_key: 'HGHEHwZIdy9U72xERlZQ',
    consumer_secret: 'uBBpzMKtKS6xK4zCNHCRk8vs0qQ1jtEeLyS1bqti8',
    access_token_key: '250090286-bYaAOcA557DnGhs8KjlkGJwUnBcZB6B4McHC6AMd',
    access_token_secret: 'CmHOuzo5wuBXrh3NIs1BQw0l8l9R6sOdiFMf1vBJU'
});

//tweet.stream('statuses/filter', {'locations': boxes}, function(stream) {
//     stream.on('data', function(data) {
// 	console.log('@' + data.user.screen_name + ' : ' + data.text);
//     });
// });
//var my_file = fs.openSync('stream_unizar.log', 'a');

function comprueba(tableclass, id, callbackObj) {
    db.command("SELECT FROM " + tableclass + " where id = " + id, function(err,results) {
	if (results.length == 0) {
            callbackObj.final()
	} else {
            callbackObj.final(results[0]["@rid"]);  //o es 1??
	} 
    });
}

function Holder(tipo,savemethod,finalcallback,data){
        //this.final= function(x) {
        //     console.log("final"+this.constructor.name);
        //     this.method.call(this,x);
        //     };
	this.origdata = data;
        console.log("Holder:"+this.constructor.name);
        //console.log(JSON.stringify(data));
        console.log("Holder - dataid ="+data.id); 
	this.final= savemethod;  // parece que no hace falta pero es el alma de la fiesta
	this.callback=finalcallback;
	comprueba(tipo,data.id,this);
}

function savePlace(placedata, finalcall) {
    console.log("savePlace as "+this.constructor.name);
    //comprueba que no existe el id; si existe devuelve el rid
        if (this.constructor != Holder) { //nos llaman sin contenedor
	var hold = new Holder("lugar",savePlace,finalcall,placedata)
	return null;
    }
 
    //nos llaman como objeto 
    callback = this.callback; // no es automatico? Igual no.
    if (plecedata){ //comprueba() ha puesto un rid en data
	callback(null, placedata);
	return null;
    }
     
    //no hay rid, es todo nuevo 
    // this.origdata
    
    //TO DO: save place
    
    callback(null, rid);
}

function saveAuthor(authordata, finalcall) {
    console.log("saveAuthor as "+this.constructor.name);
    //comprueba que no existe el id; si existe devuelve el rid
        if (this.constructor != Holder) { //nos llaman sin contenedor
	var hold = new Holder("usuario",saveAuthor,finalcall,authordata)
	return null;
    }
 
    //nos llaman como objeto 
    callback = this.callback; // no es automatico? Igual no.
    if (authordata){ //comprueba() ha puesto un rid en data
	callback(null, authordata);
	return null;
    }
     
    //no hay rid, es todo nuevo
    //data = this.origdata;
    
    // TO DO: usuario podria tener lugares nuevos, que habria que verificar con savePlace
    
    // TO DO: save user
    rid = -1;
    
    callback(null, rid);//no error, devolvemos el rid
}

function createEdges(tweetRid, entities) {
  //TO DO NEXT
  //de momento solo hashtags. Podemos hacer un
  //for key en entities, y considerarlos todos
  //de la misma clase, o hacer un caso
  //especial con mentions, que pueden ser authors o no
}

function saveTweet(data, finalcall) {
    console.log("saveTweet as "+this.constructor.name);
    if (this.constructor != Holder) { //nos llaman sin contenedor
	var hold = new Holder("mensaje",saveTweet,finalcall,data)
	return null;
    }
 
    //nos llaman como objeto 
    callback = this.callback; // no es automatico? Igual no.
    if (data){ //comprueba() ha puesto un rid en data
	callback(null, data);
	return null;
    }
     
    //no hay rid, es todo nuevo
    data = this.origdata;
  
    var sustituciones = {
	user: function(callback) {
	    saveAuthor(data.user, callback);
	},
	place: function(callback) {
	    if (data.place) {
		savePlace(data.place, callback);
	    } else {
               callback();
            }
	},
	retweeted_status: function(callback) {
	    if (data.retweet) {
		saveTweet(data.retweeted_status, callback);
	    } else {
               callback();
            }
	}
    };
    callback("lanzando paralelo "+sustituciones);  
    asincrono.parallel(sustituciones, function(err, results) {
	if (err) {
	    console.log("fallo el paralelo " + err);
	} else {
            //acepta rids, graba dato ... 
            for (key in results) {
		data[key]=results[key]; 
            }
            data["@class"]="mensaje";
            //TO DO: la fecha, vale tal como esta?
            db.save(data, function(err, data) {
		if (err) {
		    console.log("db fail "+ err);
		} else {
		    console.log("result:"+data["@rid"]);
		    // ... y crea entidades; lo hacemos aqui por si hay llamadas recursivas a saveTweet 
		    createEdges(data["@rid"], data["entities"]);
		    // TO DO: podriamos plantearnos Edges especiales:
		    //     if (in_reply_to_status_id) ...
		    //     if (in_reply_to_user_id) ....
		    //     if (retweeted_status) ....
		    callback(null,data["@rid"]);
		}

		return null;
            });
	}
    });

    // si llegamos aqui, mal vamos
    callback("SaveTweet terminando");
    return null;
}

db.open(function(err, result) {
    tweet.stream('statuses/filter', {'track': keywords}, function(stream) {
	stream.on('data', function(data) {
	    //	fs.writeSync(my_file, JSON.stringify(data), null);
	    //	fs.writeSync(my_file, '\n', null);
	    //	fs.fsyncSync(my_file);
            saveTweet(data, console.log);  
	});
    });
});
