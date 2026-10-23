OLD_EFFECT = "      useEffect(() => {\n        if (generationState === 'loading' && generationRequestRef.current.abortController) {\n          generationRequestRef.current.abortController.abort();\n          setGenerationState('idle');\n        }\n      }, [eventContext, dualJourney, dualJourneyType]);"
NEW_CANCEL = "      const invalidateGeneration = () => {\n        const previous = generationRequestRef.current;\n        generationRequestRef.current = { id: previous.id + 1, abortController: null, waitTimer: null };\n        clearTimeout(previous.waitTimer);\n        previous.abortController?.abort();\n      };\n      const cancelGeneration = () => {\n        invalidateGeneration();\n        setGenerationState('idle');\n        setGenerationError(null);\n        setGenerationWarning(null);\n        setShowRetryHint(false);\n      };\n      useEffect(() => () => invalidateGeneration(), []);\n      useEffect(() => {\n        if (generationRequestRef.current.abortController) cancelGeneration();\n      }, [eventContext, dualJourney, dualJourneyType, currentView, isAuthenticated, lang, wardrobe]);\n\n"
import hashlib
from pathlib import Path

EXPECTED = {
    'index-preview.html': 'a282c61ad4c191b1b87457628bca40fcad0861c1',
    'src/engine/provider.js': 'ce91ce78559a5503b6bc7c4da5129b6ba0dae265',
    'src/engine/browser.js': '33fb99da5f2efc7c80ea90b810ae9871b65ccd32',
    'index.html': '2142d0bd6d20e2d50d4864eaf2d33560bb00cec9'
}
def git_blob(data):
    return hashlib.sha1(b'blob ' + str(len(data)).encode() + bytes([0]) + data).hexdigest()
def once(text, before, after):
    if text.count(before) != 1: raise ValueError('Expected exactly one match: ' + before[:90])
    return text.replace(before, after, 1)

def apply():
    source = {}
    for name, expected in EXPECTED.items():
        path = Path(name)
        if path.is_symlink(): raise ValueError('Refusing symlink: ' + name)
        data = path.read_bytes()
        if git_blob(data) != expected: raise ValueError('Version changed; refusing patch: ' + name)
        source[name] = data.decode('utf-8')
    html = once(source['index-preview.html'], OLD_EFFECT, '')
    start = html.index('      const cancelGeneration = () => {')
    end = html.index('      const resetInteractionState = () => {', start)
    html = html[:start] + NEW_CANCEL + html[end:]
    start = html.index('      const generatePrescription = async (extraIntent = null) => {')
    end = html.index('\n      //', start)
    function = html[start:end]
    if not function.rstrip().endswith('};'): raise ValueError('Unknown function boundary')
    function = once(function, '        cancelGeneration();', '        invalidateGeneration();')
    function = once(function, '        const abortController = new AbortController();', """        const abortController = new AbortController();
        const isCurrent = () => generationRequestRef.current.id === requestId && !abortController.signal.aborted;
        const assertCurrent = () => {
          if (!isCurrent()) throw new DOMException('Canceled', 'AbortError');
        };""")
    function = once(function, 'if (generationRequestRef.current.id === requestId) setShowRetryHint(true);', 'if (isCurrent()) setShowRetryHint(true);')
    function = once(function, '          const engine = window.__ARACHNE_ENGINE__;', '          assertCurrent();\n          const engine = window.__ARACHNE_ENGINE__;')
    function = once(function, '          const response = await engine.generate({', '          const response = await window.__ARACHNE_ASYNC__.abortable(engine.generate({')
    function = once(function, '            signal: abortController.signal\n          });', '            signal: abortController.signal\n          }), abortController.signal);')
    if function.count('if (generationRequestRef.current.id !== requestId) return;') != 2:
        raise ValueError('Unknown request guard structure')
    function = function.replace('if (generationRequestRef.current.id !== requestId) return;', 'if (!isCurrent()) return;')
    function = once(function, 'await new Promise((resolve) => setTimeout(resolve, runtimeMin - elapsed));', 'await window.__ARACHNE_ASYNC__.delay(runtimeMin - elapsed, abortController.signal);')
    function = once(function, "          if (response.result?.status !== 'success') {", "          assertCurrent();\n          if (response.result?.status !== 'success') {")
    function = once(function, '          setCurrentOutfit(mapped);', '          assertCurrent();\n          setCurrentOutfit(mapped);')
    function = once(function, '            generationRequestRef.current.abortController = null;', '            generationRequestRef.current.abortController = null;\n            setShowRetryHint(false);')
    html = html[:start] + function + html[end:]
    for old, setter in [
        ('onClick={() => setEventContext(ev.id)}', 'setEventContext(ev.id)'),
        ('onClick={() => setDualJourney(!dualJourney)}', 'setDualJourney(!dualJourney)'),
        ('onClick={() => setDualJourneyType(dj.id)}', 'setDualJourneyType(dj.id)')
    ]:
        replacement = """disabled={isGenerating}
                          aria-disabled={isGenerating}
                          style={isGenerating ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}
                          onClick={() => { if (!generationRequestRef.current.abortController) SETTER; }}""".replace('SETTER', setter)
        html = once(html, old, replacement)
    provider = source['src/engine/provider.js']
    start = provider.index('function raceTimeout(ms, signal) {')
    end = provider.index('function buildRequest(', start)
    provider = "import { aborted, fetchRemote } from './async-control.js';\n" + provider[:start] + provider[end:]
    for before, after in [
        ('    const contextValidation = validateContext({ ...context, intent });', '    aborted(signal);\n    const contextValidation = validateContext({ ...context, intent });'),
        ('        const responseContract = validateGenerateResponse(remotePayload);', '        aborted(signal);\n        const responseContract = validateGenerateResponse(remotePayload);'),
        ("        if (error?.name === 'AbortError') throw error;", "        aborted(signal);\n        if (error?.name === 'AbortError') throw error;"),
        ('    const local = generateLocalOutfit({', '    aborted(signal);\n    const local = generateLocalOutfit({'),
        ('    if (!local.ok) {', '    aborted(signal);\n    if (!local.ok) {')
    ]: provider = once(provider, before, after)
    browser = "import * as asyncControl from './async-control.js';\n" + source['src/engine/browser.js']
    browser = once(browser, 'globalThis.__ARACHNE_ENGINE__ = engine;', 'globalThis.__ARACHNE_ASYNC__ = asyncControl;\nglobalThis.__ARACHNE_ENGINE__ = engine;')
    for name, content in {'index-preview.html': html, 'src/engine/provider.js': provider, 'src/engine/browser.js': browser}.items():
        with Path(name).open('w', encoding='utf-8', newline='') as stream: stream.write(content)
    assert git_blob(Path('index.html').read_bytes()) == EXPECTED['index.html']

if __name__ == '__main__': apply()
