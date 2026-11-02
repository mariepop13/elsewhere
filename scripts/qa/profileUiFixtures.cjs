const { makeDatabase: baseDatabase, encodeDatabase } = require('./nativeUiFixtures.cjs');
function makeDatabase() {
 const db=baseDatabase();db.selectedPersona=0;db.personas.push({id:'fixture-alternate-persona',name:'Fixture alternate persona',icon:'',personaPrompt:''});db.characters[0].chats[0].bindedPersona='fixture-alternate-persona';
 db.socialFeed.cast.push({characterId:'fixture-nell',name:'Fixture Nell',publicProfile:'A public fixture friend.'});db.socialFeed.cast[0].startingFacts='PRIVATE STARTING';db.socialFeed.cast[0].startingFactsVisibility='private';
 const author={id:'character:fixture-jun',characterId:'fixture-jun',name:'Fixture Jun'};
 const post=(id,text,visibleToActorIds)=>({id,author,text,createdAt:100,liked:false,responses:[],...(visibleToActorIds?{visibleToActorIds}:{})});
 db.socialFeed.posts=[post('fixture-public','PUBLIC POST'),post('fixture-circle','CIRCLE ONLY',['fixture-jun'])];
 const binding={saveId:'fixture-save',worldId:'fixture-world',ownerId:'fixture-owner'},events=[],registry=[],notes=[];
 const append=(personaId,id,text,scope='private',known=true)=>{
  const relation={worldId:binding.worldId,subject:{kind:'persona',id:personaId},other:{kind:'character',id:'fixture-jun'}},participants=[relation.subject,relation.other];
  const source=scope==='public'?{saveId:binding.saveId,worldId:binding.worldId,kind:'public_post',postId:'fixture-public',author:{kind:'character',id:'fixture-jun'},participants}:{...binding,kind:'authored_note',recordId:id+'-note',participants};
  const sourceId=JSON.stringify(scope==='public'?[binding.saveId,binding.worldId,'public_post','fixture-public']:[binding.saveId,binding.worldId,'authored_note',binding.ownerId]);
  const sourceEventId=JSON.stringify([source.kind,scope==='public'?'fixture-public':source.recordId,id]);
  events.push({id,relation,sourceId,sourceEventId,actionType:'relationship.initialized',time:100,scope,knownBy:known?participants:[relation.other],summary:text,description:text,changes:scope==='public'?{familiarity:{set:25}}:{trust:{set:personaId==='fixture-player'?40:70}}});registry.push({eventId:id,commandId:id,source});if(scope==='private')notes.push({id:source.recordId,relation,text});
 };
 append('fixture-player','main-event','MAIN AUTHORIZED MEMORY');append('fixture-alternate-persona','alt-event','ALT AUTHORIZED MEMORY');append('fixture-player','hidden-event','UNAUTHORIZED MEMORY','private',false);append('fixture-player','public-event','PUBLIC EXPLANATION','public');
 db.worldWorkspace.relationshipWorkspace={version:1,binding,state:{version:1,...binding,ledger:{version:1,events},registry},notes};return db;
}
module.exports={makeDatabase,encodeDatabase};
