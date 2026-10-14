// Offline CLI tests only. No network, database or deployment.
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'baylior-preflight-'));
const config=path.join(folder,'settings.json');
const script=fileURLToPath(new URL('./check-staging.mjs',import.meta.url));
const good={signupOrigin:'https://signup.test',apiOrigin:'https://api.test',productUrl:'https://website.test/products/baylior/',termsUrl:'https://website.test/terms/',refundUrl:'https://website.test/refund/',privacyUrl:'https://website.test/privacy/',installerContactFallback:true,paymentMode:'contact',throwawayCatalogueConfirmed:false};
const cases=[
 [{...good,signupOrigin:null},1],
 [good,0],
 [{...good,apiOrigin:'http://api.test'},1],
 [{...good,apiOrigin:'https://api.test/api'},1],
 [{...good,paymentMode:'test'},1],
 [{...good,paymentMode:'test',throwawayCatalogueConfirmed:true},0],
 [{...good,installerContactFallback:false},1],
 [{...good,paymentMode:'gateway'},1]
];
try {
  for(const [settings,status] of cases) {
    fs.writeFileSync(config,JSON.stringify(settings));
    const result=spawnSync(process.execPath,[script,'--config',config],{encoding:'utf8'});
    assert.equal(result.status,status,result.stderr);
  }
  console.log(`PASS: ${cases.length} offline staging-preflight cases.`);
} finally {fs.unlinkSync(config);fs.rmdirSync(folder);}
