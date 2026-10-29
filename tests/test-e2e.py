"""E2E simulation via set_content. The test sandbox's managed Chromium blocks all URLs,
so assets/scripts are injected into about:blank; GitHub Pages itself serves normally."""
from playwright.sync_api import sync_playwright
from pathlib import Path
import json, re, base64
BASE=Path('/mnt/data/suthers-cup-site')
OUT=BASE/'tests'
HTML=(BASE/'index.html').read_text()
HTML=re.sub(r'<link[^>]+href="https?://[^>]+>', '', HTML)
HTML=re.sub(r'<link[^>]+href="styles.css"[^>]*>', '', HTML)
HTML=re.sub(r'<script[^>]+src="[^"]+"[^>]*></script>', '', HTML)
for path in (BASE/'assets').iterdir():
 if path.suffix.lower() not in ('.svg','.webp'):continue
 mime='image/svg+xml' if path.suffix=='.svg' else 'image/webp'
 url='data:'+mime+';base64,'+base64.b64encode(path.read_bytes()).decode()
 HTML=HTML.replace('"assets/'+path.name+'"','"'+url+'"')
CSS=(BASE/'styles.css').read_text()
HISTORY=(BASE/'history.js').read_text()
CORE=(BASE/'tournament-core.js').read_text()
APP=(BASE/'app.js').read_text()
# Keep dynamically rendered asset paths working in the about:blank test harness.
APP=APP.replace('assets/eight-ball-icon.svg', 'data:image/svg+xml;base64,'+base64.b64encode((BASE/'assets/eight-ball-icon.svg').read_bytes()).decode())

def boot(browser, size, saved=None):
 ctx=browser.new_context(viewport={'width':size[0],'height':size[1]},accept_downloads=True)
 p=ctx.new_page()
 issues=[]
 p.on('pageerror', lambda e:issues.append(str(e)))
 p.set_content(HTML,wait_until='domcontentloaded')
 p.add_style_tag(content=CSS)
 value=json.dumps(saved or {})
 p.evaluate('''data => {
   const memory=JSON.parse(data);
   Object.defineProperty(window,'localStorage',{configurable:true,value:{
     getItem:k=>Object.prototype.hasOwnProperty.call(memory,k)?memory[k]:null,
     setItem:(k,v)=>{memory[k]=String(v)},removeItem:k=>{delete memory[k]},clear:()=>{for(const k in memory)delete memory[k]}
   }});
   window.__testMemory=memory;
   window.__downloadFilename=null; window.__lastBlob=null;
   URL.createObjectURL=(blob)=>{window.__lastBlob=blob;return 'blob:mock'};
   URL.revokeObjectURL=()=>{};
   HTMLAnchorElement.prototype.click=function(){window.__downloadFilename=this.download};
   window.print=()=>{window.__printCalled=true};
 }''',value)
 for script in (HISTORY,CORE,APP): p.add_script_tag(content=script)
 return ctx,p,issues

with sync_playwright() as pw:
 b=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 ctx,page,issues=boot(b,(1440,920))
 assert page.locator('#view-home').is_visible()
 assert page.locator('#home-stats .hero-stat').count()==4
 assert page.locator('#home-stats img.stat-eightball-icon').count()==1
 assert page.locator('#view-home img.feature-eightball-icon').count()==1
 assert page.locator('#home-stats img.stat-eightball-icon').evaluate('(img)=>img.complete&&img.naturalWidth>0')
 assert page.locator('#view-home img.feature-eightball-icon').evaluate('(img)=>img.complete&&img.naturalWidth>0')
 assert page.locator('#history-body tr').count()==33
 page.screenshot(path=str(OUT/'preview-desktop.png'),full_page=True)
 page.locator('button[data-nav="edition"]').first.click()
 assert page.locator('#setup-panel').is_visible()
 names=['Kyle Moritz','Nick Sutherland','Andy McKay','Gary Chadwick','Peter Wall','Matt Sellar','Lloyd Cooper','Chris Barker']
 for i,n in enumerate(names):page.locator(f'[data-player-index="{i}"]').fill(n)
 page.locator('#max-matches').fill('20')
 page.locator('#min-matches').fill('3')
 assert '17' in page.locator('#draw-preview').inner_text()
 page.locator('#generate-draw-btn').click()
 assert page.locator('#tournament-panel').is_visible()
 assert page.locator('.fixtures-grid .match-card').count()==17
 for i in range(17):
  page.locator('.fixtures-grid .match-card').nth(i).locator('button[data-rr-winner]').first.click()
 assert '17 / 17' in page.locator('#live-kpis').inner_text()
 page.locator('button[data-subtab="knockout"]').click()
 assert page.locator('.bracket-stage').count()==2
 for i in range(2): page.locator('.bracket-stage').first.locator('.match-card').nth(i).locator('button[data-ko-winner]').first.click()
 page.locator('.bracket-stage').last.locator('.match-card').locator('button[data-ko-winner]').first.click()
 assert 'Champion confirmed' in page.locator('.knockout-aside').inner_text()
 assert page.locator('#history-body tr').count()==34
 assert 'CHAMPION' in page.locator('#print-sheet').inner_text()
 page.locator('#export-json-btn').click()
 backup=json.loads(page.evaluate('async()=>await window.__lastBlob.text()'))
 assert page.evaluate('window.__downloadFilename')=='edition34.json'
 assert len(backup['state']['tournament']['roundRobin'])==17
 assert len(backup['state']['koResults'])==3
 (OUT/'sample-test-backup.json').write_text(json.dumps(backup,indent=2))
 page.locator('#print-btn').click()
 assert page.evaluate('window.__printCalled') is True
 saved=page.evaluate('window.__testMemory')
 assert 'suthers-cup-edition-34-v1' in saved
 assert not issues, issues
 # Simulate refresh as a separate DOM boot with the same browser storage content.
 ctx2,p2,issues2=boot(b,(1440,920),saved=saved)
 assert p2.locator('#history-body tr').count()==34
 p2.evaluate("location.hash='#edition'")
 assert p2.locator('#tournament-panel').is_visible()
 assert p2.locator('#save-status').inner_text()=='Saved automatically on this device'
 for width,height in [(390,844),(320,780),(768,1024)]:
  p2.set_viewport_size({'width':width,'height':height})
  for view in ['home','history','rules','edition']:
   p2.evaluate("v => {location.hash = '#'+v}",view)
   p2.wait_for_timeout(50)
   dims=p2.evaluate('({body:document.body.scrollWidth,view:innerWidth})')
   assert dims['body']<=dims['view']+2,(view,width,dims)
  if width==390:
   p2.evaluate("location.hash='#home'")
   p2.screenshot(path=str(OUT/'preview-mobile.png'),full_page=True)
   p2.evaluate("location.hash='#edition'")
   p2.screenshot(path=str(OUT/'preview-mobile-edition.png'),full_page=True)
 assert not issues2, issues2
 # New browser has no state; restore from exported JSON.
 ctx3,p3,issues3=boot(b,(390,844))
 p3.evaluate("location.hash='#edition'")
 assert p3.locator('#setup-panel').is_visible()
 p3.on('dialog',lambda dialog:dialog.accept())
 p3.locator('#import-file-input').set_input_files({'name':'edition34.json','mimeType':'application/json','buffer':json.dumps(backup).encode()})
 p3.wait_for_timeout(150)
 assert p3.locator('#tournament-panel').is_visible()
 assert p3.locator('#history-body tr').count()==34
 p3.locator('button[data-subtab="knockout"]').click()
 p3.locator('.bracket-stage').first.locator('.match-card').first.locator('button[data-ko-winner]').last.click()
 assert p3.locator('#history-body tr').count()==33
 assert p3.locator('.bracket-stage').last.locator('.match-card').locator('.match-player.winner').count()==0
 assert not issues3, issues3
 print('PASS E2E: responsive layout at 1440, 768, 390 and 320 pixels; complete tournament flow; archive; save/restore; PDF invocation; cascading correction; zero JS errors')
 b.close()
