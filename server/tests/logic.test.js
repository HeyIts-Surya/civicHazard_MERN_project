import test from 'node:test';import assert from 'node:assert/strict';
import {votingResult,coordinatesValid,distanceMeters,similarity} from '../src/utils/logic.js';
test('5 yes / 1 no is community verified',()=>assert.equal(votingResult(5,1).verified,true));
test('5 yes / 2 no is NOT community verified',()=>assert.equal(votingResult(5,2).verified,false));
test('4 unanimous yes is not enough',()=>assert.equal(votingResult(4,0).verified,false));
test('disputes can return a report to unverified',()=>assert.equal(votingResult(5,3).verified,false));
test('geo coordinates validate latitude and longitude',()=>{assert.equal(coordinatesValid(30.2,78.7),true);assert.equal(coordinatesValid(96,78),false);});
test('GPS nearby distance in meters',()=>{assert.ok(distanceMeters(30.2,78.7,30.2,78.7005)<1000);assert.ok(distanceMeters(30.2,78.7,30.22,78.7)>1000);});
test('similar descriptions rank as likely duplicate',()=>assert.ok(similarity('landslide blocks mountain highway road','landslide blocks highway road near tunnel')>0.48));
