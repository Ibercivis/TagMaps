var boxes = '-18.16,27.63,-13.4,30.0,-7.523,36.0,-1.6274,38.7289,-7.5416,37.35,4.33,40.48,-7.08,40.48,4.33,41.807,-9.3,41.807,-0.73,43.8,-0.73,41.807,3.34,43.0,-2.9755,35.2560,-2.91,35.337,-5.3822,35.8715,-5.2783,35.9180';
var totaltasks=3000; //para evitar problemas de memoria del Java
//var keywords = 'unizar,@unizar,#unizar,zaragoza,bifi,ibercivis,iberus,chema gimeno,manolo lopez,universidad de zaragoza';
//var users = '';

//See https://github.com/Ibercivis/TagMaps/blob/227efe38bc0770fa5e1c003252321ddb7766e5ae/src/demo1/server.js
//for a more verbose file. Now we are cleaning some logs and comments

// LA BBDD USA:

//
//create database "local:databases/twmobileSpain" admin admin local graph
//connect "remote:localhost/../databases/twmobileSpain" admin admin
//create class mensaje extends OGraphVertex;
//create class usuario extends OGraphVertex;
//create class lugar extends OGraphVertex;  
//create class hashtag extends OGraphVertex;     
//
//create property hashtag.name string;
//create index uniqname on hashtag(name) unique;
//etc for .id on usuario lugar y mensaje
//create property mensaje.created_at Datetime
//create index dateidx on mensaje(created_at) notunique



var asincrono = require('async');
var util = require('util');
var twitter = require('immortal-ntwitter');
var crypto = require('crypto');
var orient = require("orientdb");
var Db = orient.Db;
var graphDb=orient.GraphDb;
var Server = orient.Server;

var dbConfig = {
    user_name: "admin",
    user_password: "admin"
};

var serverConfig = {   // SET YOUR OWN SERVER HERE
    host: "node3.ibercivis.es",
    port: 2424,
    user_name: "root",
    user_password: "1BC4405B68869D481A182C4BACC55A4D40EE30D972919819830865FBB5049CE1" 
              //"F181EE145A172DD7D24B69379E1202FA2E6315EF66910CA106DF13B5F6F56B48"
};

var server = new Server(serverConfig);
var db = new graphDb("moSpain", server, dbConfig);

  //  CHANGE THE KEYS FOR YOUR TWITTER APPLICATION, OR IT WILL NOT WORK PROPERLY
  //  see http://...     to register your own keys    <--- Juanjo, donde estaba documentado esto??
  //
var tweet = twitter.create({    
    consumer_key: 'HGHEHwZIdy9U72xERlZQ',
    consumer_secret: 'uBBpzMKtKS6xK4zCNHCRk8vs0qQ1jtEeLyS1bqti8',
    access_token_key: '250090286-bYaAOcA557DnGhs8KjlkGJwUnBcZB6B4McHC6AMd',
    access_token_secret: 'CmHOuzo5wuBXrh3NIs1BQw0l8l9R6sOdiFMf1vBJU'
});



function comprueba(tableclass, id, callbackObj) {
    //this function DOES NOT need to load the document, so it is a lot faster 
    //to search on the index. 
    db.command("SELECT FROM " + tableclass + " where key = '" + id+"'", function(err,results) {
	if (results.length == 0) {
            callbackObj.final()
	} else {
            //console.log("res:"+JSON.stringify(err)+JSON.stringify(results));
            callbackObj.final(results[0]["rid"]); 
	} 
    });
}


var cerrojos = []; //node.js es monohilo, asi que solo hay que tener "mutex" para el I/O de la BBDD
function Holder(tipo,savemethod,finalcallback,data){
        this.datahash = data.id ;//crypto.createHash('md5').update(data).digest();
        var that = this;
        if (cerrojos.indexOf(this.datahash)> -1) {
           console.log("esperando"+data.id); 
           setTimeout(function(){ Holder.call(that, tipo, savemethod, finalcallback, data)},1000);
        } else {
        //console.log("lock for "+this.datahash);
        cerrojos.push(this.datahash);
	this.origdata = data;
        //console.log("Holder - dataid ="+data.id); 
	this.final= savemethod;  // parece que no hace falta pero es el alma de la fiesta
	this.callback=function(err,result){
                    //console.log("finalcallbak: " + typeof(finalcallback));
                    //console.log("err:"+err+JSON.stringify(err));
                    //console.log("result:"+result+JSON.stringify(result));
                    //console.log("levantando lock "+that.datahash+"/"+data.id+"/"+this.datahash+"/"+result+" de un total de "+cerrojos.length);
                    cerrojos.splice(cerrojos.indexOf(data.id),1);
                    //console.log(cerrojos);
                    finalcallback(err,result);
                    }
	comprueba(tipo,data.id,this);
        }
}

function savePlace(placedata, finalcall) {  //TO BE DONE
    console.log("enter savePlace as "+this.constructor.name);
    if (this.constructor != Holder) { //nos llaman sin contenedor
	var hold = new Holder("index:uniqidlugar",savePlace,finalcall,placedata)
	return null;
    }
    // nos llaman como objeto 
    callback = this.callback; // no es automatico? Igual no.
    if (plecedata){ //comprueba() ha puesto un rid en data
	callback(null, placedata);
	return null;
    }
    //no hay rid, es todo nuevo 
    // this.origdata
    // 
    //TO DO: save place
    //
    callback(null, rid);
}

function saveAuthor(authordata, finalcall) {
    if (this.constructor != Holder) { //nos llaman sin contenedor
	var hold = new Holder("index:uniqidusuario",saveAuthor,finalcall,authordata)
	return null;
    }
    //nos llaman como objeto 
    callback = this.callback; // hay un with automatico para this o no? 
    if (authordata){ //comprueba() ha puesto un rid en data
	callback(null, authordata);
	return null;
    }
    //no hay rid, es todo nuevo
    data = this.origdata;
    data ["@class"]="usuario";
    var that=this;
    // TO DO: usuario podria tener lugares nuevos, que habria que verificar con savePlace
    db.save(data, function(err, data) {
		if (err) {
		    console.log("db author fail "+ JSON.stringify(err)+JSON.stringify(data));
                    that.callback(err,-1);
		} else {
		    //console.log("user result:"+data["@rid"]);
		    that.callback(null,data["@rid"]);
		}
           }); 
}

var linlock=0
function saveLink(fromData,htItem,cbIter) { //fromData, text) {
  if (linlock) { setTimeout(function() {saveLink(fromData,htItem,cbIter)},100) 
  } else {
  linlock++
  var text = htItem.text;
  console.log (linlock+"try to save from "+fromData["@rid"]+ " to "+ text);
  asincrono.waterfall([
    function(cb){
        //ojo: select from index devuelve el index, que solo tiene el rid a secas.
        //probablemente funcione igual de rapido el buscar directamente el documento,
        //pero no hay forma de verificar que esta usando el indice.
        db.command("SELECT FROM index:uniqname where key = '" + text +"'", function(err,results) {
        //TO DO: consider error
            if (results.length == 0) {
              cb(null,null);
            }      else {
              cb(null,results[0].rid); 
            }
           }
        );
      },
    function(rid,cb) {
       if (rid) {
         db.loadRecord(rid, function(err, record) {
         //TO DO: consider error
             //console.log (JSON.stringify(record));
             cb(null,record);});
       } else {
       cb(null,null);
       }
    },
    function(toData,cb){ 
       if (toData) {
         cb(null,toData); 
       } else {
         data = {"@class": "hashtag",name: text};
         db.save(data, function (err,data) {  if (err) {
          console.log ("db vertex fail"+JSON.stringify(err)+JSON.stringify(data));
           cb(err);
          } else {
           cb(null,data);
          }
         });
        }
       },
    function(toData,cb) {
          //console.log ("ok to save from "+fromData["@rid"]+ " to "+ toData["@rid"]);
          //console.log (JSON.stringify(fromData));
          //console.log (JSON.stringify(toData));
          db.createEdge(
            fromData,  // {"@rid":fromRid, "@class":"mensaje"},
            toData, // {"@rid":rid, "@class": "hashtag"},
            function(err,result,a,b) { 
                                   if (err) { 
                                     console.log("Edge error:"+JSON.stringify(err));
                                     cb(err);
                                    } else {
                                     //console.log ("saved_edge_from"+JSON.stringify(fromData));
                                     //console.log ("compare with"+JSON.stringify(a)); 
                                     //console.log ("saved_edge_to"+JSON.stringify(toData));
                                     //console.log ("saved from "+fromData["@rid"]+ " to "+ toData["@rid"]);
                                     cb(null,fromData);
                                    }
                                  });
       }
    ], function(err,modFrom) {  /////cerrojos.splice(cerrojos.indexOf(""+modFrom.id));
                                linlock--;
                                if (err) {console.log("waterfall  error:"+JSON.stringify(err));
                                      cbIter("posible colision?",modFrom);
                                } else { 
                                      //console.log ("returning vertex"+JSON.stringify(fromData));
                                      cbIter(null,modFrom)} }
   );
 }
}


function createEdges(tweetData, entities,finalcall) {
  //de momento solo hashtags. Podemos hacer un
  //for key en entities, y considerarlos todos
  //de la misma clase, o hacer un caso
  //especial con mentions, que pueden ser authors o no
  if (entities.hashtags.length > 0) {
    //console.log("hashtags to be saved:"+JSON.stringify(entities.hashtags));
    asincrono.reduce(entities.hashtags,
                    tweetData,
                    saveLink,
                    function (err, res) { if (err) {finalcall("problemas en hashtags",-1)} else {finalcall(null,res["@rid"]);}}
                    );
  } else {
     finalcall(null,tweetData["@rid"]);
  } 
  //for (var i in entities.hashtags) {  with (entities.hashtags[i]) {
}

function saveTweet(data, finalcall) {
    if (this.constructor != Holder) { //nos llaman sin contenedor
	new Holder("index:uniqidmensaje",saveTweet,finalcall,data)
	return null;
    }
    //nos llaman como objeto 
    if (data)  { // esto es, que comprueba() ha puesto un rid en data
	this.callback(null, data);
	return null;
    }
    //no hay rid, es todo nuevo
    data = this.origdata;
    finalcall=this.callback;

    // TO DO: Poner solo los que existen, para minimizar paralelismos 
    var sustituciones = {
	user: function(callback) {
	    saveAuthor(data.user, callback);
	},
	place: function(callback) {
	    if (false) { // (data.place) {
		savePlace(data.place, callback);
	    } else {
               callback();
            }
	},
	retweeted_status: function(callback) {
	    if (false) { // (data.retweet) {
		saveTweet(data.retweeted_status, callback);
	    } else {
               callback();
            }
	}
    };
    //ojo, parece que parallell mete un callback en el scope, asi
    //que hay que usar finalcall. 
    asincrono.parallel(sustituciones, function(err, results) {
	if (err) {
	    console.log("fallo el paralelo " + err);
	} else {
            //acepta rids, graba dato ... 
            for (key in results) {
		data[key]=results[key]; 
            }
            data["@class"]="mensaje";
            //la fecha, vale tal como esta? Mejor la cambiamos a fecha de verdad
            data.created_at=new Date(data.created_at);
            data.created_at=data.created_at.toISOString().replace('T',' ')
            db.save(data, function(err, data) {
		if (err) {
		    console.log("db fail "+ err + JSON.stringify(err));
                    finalcall(err);
		} else {
                    //console.log("grabado "+data["@rid"]+" con author "+data.user);
		    // ahora crea entidades; lo hacemos aqui por si hay llamadas recursivas a saveTweet 
		    createEdges(data, data["entities"],finalcall);
		    // TO DO: podriamos plantearnos Edges especiales:
		    //     if (in_reply_to_status_id) ...
		    //     if (in_reply_to_user_id) ....
		    //     if (retweeted_status) ....
		    //finalcall(null,data["@rid"]);
		}
            });
	}
    });
    return null;
}

db.open(function(err, result) {
      if (err) {console.log(err,JSON.stringify(result)); process.exit(2)};
      var sem=0;
      var salir=0;
      var hechos=0;
      var colapendiente=[];
      setInterval(function() { console.log(" pendientes:"+colapendiente.length+" hechos:"+hechos);
                               if (hechos==0) {console.log("no contact in last five minutes, lets kill");
                                               process.exit(1); };
                               hechos=0;
                              } , 300*1000);
//    tweet.stream('statuses/filter', {'track': keywords}, function(stream) {
      tweet.stream('statuses/filter',  {'locations': boxes}, function(stream) {
        process.on('SIGINT', function(){  salir++; 
                                          //stream.removeAllListeners('data');
                                          console.log("Control-C, parando stream");
                                       });
        stream.on('error', function(err) {console.log("stream err"+JSON.stringify(err));});
	stream.on('data', function(data) {
          //console.log("data"+JSON.stringify(data));
            if (data){ console.log(colapendiente.length+":"+cerrojos.length+'@' + data.user.screen_name + ' : ' + data.text)};
            if (data) {colapendiente.push(data);}
            if (sem < 10) { 
            sem++;
            totaltasks--;
            if (totaltasks == 0) {salir++};
            data=colapendiente.shift();
            saveTweet(data, function (err,data) {
                         if (err) {console.log("data end  with error "+err)}
                         if (salir) {stream.destroy();}
                         if (salir && (colapendiente.length==0)&&(cerrojos.length==0)) {
                            db.close(function(err){
                               //assert(!err, "Error while closing the database: " + err);
                               console.log("Closed database");
                               process.exit();
                                    });
                         } else {
                            sem--;
                            hechos++;
                         }
                     });
            } else {
              setTimeout(function() { stream.emit('data',null);},Math.random()*1000*colapendiente.length);
            } 
	});
    });
});


// transacciones: las explica en http://code.google.com/p/orient/wiki/Transactions
// pero parece que van asociadas a la conexion, usease que hay que hacer un new db y db.open por cada
// agente que este dando servicio a la cola. No me fio en un mismo proceso de node
