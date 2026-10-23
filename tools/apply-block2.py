HOOKS = "      const [inventoryReady, setInventoryReady] = useState(false);\n      const [inventoryLoadError, setInventoryLoadError] = useState(false);\n      useEffect(() => {\n        let alive = true;\n        Promise.resolve(window.__ARACHNE_ENGINE_READY__).then(() => {\n          if (alive) setInventoryReady(Boolean(window.__ARACHNE_AVAILABILITY__ && window.__ARACHNE_INVENTORY_PANEL__));\n        }).catch(() => { if (alive) setInventoryLoadError(true); });\n        return () => { alive = false; };\n      }, []);\n      const missingCategoryGaps = inventoryReady ? window.__ARACHNE_AVAILABILITY__.categoryGaps(wardrobe) : [];\n      const unavailableCurrentIds = inventoryReady ? window.__ARACHNE_AVAILABILITY__.unavailableOutfitIds(currentOutfit, wardrobe) : [];\n\n"
ALERT = '                  {inventoryLoadError && <p role="alert" className="text-xs text-arachne-terracotta">{lang === \'en\' ? \'Wardrobe tools could not load. Reload the page.\' : lang === \'ca\' ? \'No s’han pogut carregar les eines de l’armari. Recarrega la pàgina.\' : \'No se pudieron cargar las herramientas del armario. Recarga la página.\'}</p>}\n                  {inventoryReady && missingCategoryGaps.length > 0 && (\n                    <div role="alert" className="p-3 rounded-xl bg-arachne-terracottaLight border border-arachne-border space-y-2">\n                      <p className="text-xs">{window.__ARACHNE_AVAILABILITY__.missingMessage(wardrobe, lang)}</p>\n                      <button type="button" className="text-xs underline" onClick={() => setCurrentView(\'wardrobe\')}>{window.__ARACHNE_AVAILABILITY__.copy(lang).review}</button>\n                    </div>\n                  )}\n                  {inventoryReady && unavailableCurrentIds.length > 0 && <p role="status" className="p-3 text-xs bg-arachne-terracottaLight rounded-lg">{window.__ARACHNE_AVAILABILITY__.copy(lang).stale}</p>}\n'
VIEW = '                {inventoryReady ? React.createElement(window.__ARACHNE_INVENTORY_PANEL__, {\n                  wardrobe, filteredGarments: filteredWardrobe, categoryKey: wardrobeFilter, lang,\n                  onChange: setWardrobe,\n                  onOpen: (item) => { setSelectedGarmentModal(item); setIsEditingGarment(false); }\n                }) : <p role="status" className="text-xs">{lang === \'en\' ? \'Loading wardrobe…\' : lang === \'ca\' ? \'Carregant l’armari…\' : \'Cargando armario…\'}</p>}\n'
import hashlib
import re
from pathlib import Path
EXPECTED_HTML = 'd4d172e4095704cf5c9ff3cd5782367d25579fdc'
EXPECTED_INDEX = '2142d0bd6d20e2d50d4864eaf2d33560bb00cec9'
def blob(data):
    return hashlib.sha1(b'blob '+str(len(data)).encode()+bytes([0])+data).hexdigest()
def once(text, before, after):
    if text.count(before) != 1: raise ValueError('Expected unique anchor: '+before[:100])
    return text.replace(before, after, 1)
def apply():
    original = Path('index.html').read_bytes()
    data = Path('index-preview.html').read_bytes()
    if blob(original) != EXPECTED_INDEX or blob(data) != EXPECTED_HTML: raise ValueError('Version changed; refusing patch')
    html = data.decode('utf-8')
    html = once(html, '      const generatePrescription = async (extraIntent = null) => {', HOOKS + '      const generatePrescription = async (extraIntent = null) => {')
    guard = """      const generatePrescription = async (extraIntent = null) => {
        const gaps = window.__ARACHNE_AVAILABILITY__?.categoryGaps(wardrobe) || [];
        if (gaps.length) {
          cancelGeneration();
          setGenerationError(window.__ARACHNE_AVAILABILITY__.missingMessage(wardrobe, lang));
          setGenerationState('error');
          return;
        }"""
    html = once(html, '      const generatePrescription = async (extraIntent = null) => {', guard)
    start = html.index("            {currentView === 'wardrobe' && (")
    end = html.index('            {/* VISTA 3:', start)
    grid = html.index('                <div className="grid grid-cols-2 gap-3 pt-1">', start, end)
    depth = 0
    grid_end = None
    for match in re.finditer(r'<(/?)div\b[^>]*>', html[grid:end]):
        depth += -1 if match.group(1) else 1
        if depth == 0:
            grid_end = grid + match.end()
            break
    if grid_end is None: raise ValueError('Could not delimit original wardrobe grid')
    html = html[:grid] + VIEW + html[grid_end:]
    design = 'onClick={() => generatePrescription()}\n                    disabled={isGenerating}'
    html = once(html, design, 'onClick={() => generatePrescription()}\n                    disabled={isGenerating || !inventoryReady || missingCategoryGaps.length > 0}')
    position = html.index('onClick={() => generatePrescription()}')
    button_start = html.rfind('<button', 0, position)
    if button_start < 0: raise ValueError('Design button missing')
    html = html[:button_start] + ALERT + html[button_start:]
    entry = html.index('        const newEntry = {')
    handlers = list(re.finditer(r'^      const (\w+) = (?:async )?\([^\n)]*\) => \{', html[:entry], re.M))
    if not handlers: raise ValueError('Wear handler not found')
    wear = handlers[-1]
    wear_end = html.index('\n      };', entry)
    body = html[wear.end():wear_end]
    if 'wornGarments' not in body or 'setHistory' not in body: raise ValueError('Unexpected wear handler')
    wear_guard = """
        if (window.__ARACHNE_AVAILABILITY__?.unavailableOutfitIds(currentOutfit, wardrobe).length) {
          showToast(window.__ARACHNE_AVAILABILITY__.copy(lang).stale);
          return;
        }
"""
    html = html[:wear.end()] + wear_guard + html[wear.end():]
    browser_path = Path('src/engine/browser.js')
    browser = browser_path.read_text(encoding='utf-8')
    if '__ARACHNE_AVAILABILITY__' in browser: raise ValueError('Block 2 already installed')
    browser = "import * as availability from './availability.js';\nimport { InventoryPanel } from '../ui/inventory-panel.js';\n" + browser
    browser = once(browser, 'globalThis.__ARACHNE_ENGINE__ = engine;', 'globalThis.__ARACHNE_AVAILABILITY__ = availability;\nglobalThis.__ARACHNE_INVENTORY_PANEL__ = InventoryPanel;\nglobalThis.__ARACHNE_ENGINE__ = engine;')
    for name, content in {'index-preview.html':html, 'src/engine/browser.js':browser}.items():
        with Path(name).open('w',encoding='utf-8',newline='') as stream: stream.write(content)
    assert Path('index.html').read_bytes() == original
if __name__ == '__main__': apply()
