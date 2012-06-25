#!/bin/bash
ourselect="select from  mensaje where created_at between date(\"2012-06-$(date +%d-%H:%M --date=26\ hours\ ago)\",\"yyyy-MM-dd-HH:mm\") and date(\"2012-06-$(date +%d-%H:%M --date=2\ hours\ ago)\",\"yyyy-MM-dd-HH:mm\") and (not (out IS null)) and (user.censored IS null)"
curl -s -u admin:admin http://xxxxxxx/command/moSpain/gremlin -d "g.step{it.next().getRawGraph().query( new com.orientechnologies.orient.core.sql.query.OSQLSynchQuery('$ourselect'))}.scatter.transform{g.getVertex(it.getIdentity())}.sideEffect{x=it}.filter{it.out.count()>1}.out.as('a').transform{x}.out.as('b').select(['a','b']).filter{it[0]<it[1]}.groupCount(){it.name}.cap().scatter.aggregate().cap().transform{groovy.json.JsonOutput.toJson(it)}"  > /tmp/result 
if [ $(grep -o value /tmp/result|wc -l) -gt 100 ]; then
  mv /tmp/result current.json
fi
