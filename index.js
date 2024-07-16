import { getRequestHeaders } from '../../../../script.js';
import { debounce, delay, uuidv4 } from '../../../utils.js';

const addBtn = ()=>{
    const nots = [
        '.select2-search__field',
        '[data-stee--handled]',
        '#send_textarea',
        '[placeholder="Entry Title/Memo"]',
    ];
    const tas = /**@type {HTMLTextAreaElement[]}*/([...document.querySelectorAll(`textarea:not(${nots.join(', ')})`)]);
    for (const ta of tas) {
        if (ta.closest('.template_element')) continue;
        ta.setAttribute('data-stee--handled', '1');
        let btn;
        let isWatching = false;
        let finalPath;
        const stop = async()=>{
            const response = await fetch('/api/plugins/files/unwatch', {
                method: 'POST',
                headers: getRequestHeaders(),
                body: JSON.stringify({
                    path: finalPath,
                }),
            });
            if (!response.ok) {
                alert('something went wrong');
                return;
            }
            isWatching = false;
            ta.style.outline = '';
        };
        ta.addEventListener('focus', ()=>{
            console.log('[STEE]', 'FOCUS', ta);
            const layer = ta.closest('dialog, body');
            const layerRect = layer.getBoundingClientRect();
            const rect = ta.getBoundingClientRect();
            btn = document.createElement('div'); {
                btn.classList.add('stee--trigger');
                btn.classList.add('menu_button');
                btn.classList.add('fa-solid');
                btn.classList.add('fa-square-up-right');
                btn.title = 'Edit in external editor\nClick again to stop editing in external editor';
                btn.style.top = `${rect.top - layerRect.top + 3}px`;
                btn.style.right = `calc(100vw - ${rect.right + layerRect.left - 15}px)`;
                btn.style.position = 'fixed';
                btn.style.zIndex = '30000';
                if (isWatching) btn.style.color = 'red';
                btn.addEventListener('pointerdown', async(evt)=>{
                    evt.preventDefault();
                    if (isWatching) {
                        stop();
                        return;
                    }
                    ta.style.outline = '5px solid red';
                    btn.style.color = 'red';
                    const name = ta.id || `${ta.closest('[id]')?.id || ''}-${(ta.name || 'textarea')}`;
                    const path = `~/user/STEE/${uuidv4()}.${name.replace(/[^a-z0-9_. ]+/gi, '-')}.txt`;

                    // save snippet to file
                    const blob = new Blob([ta.value], { type:'text' });
                    const reader = new FileReader();
                    const prom = new Promise(resolve=>reader.addEventListener('load', resolve));
                    reader.readAsDataURL(blob);
                    await prom;
                    const putResponse = await fetch('/api/plugins/files/put', {
                        method: 'POST',
                        headers: getRequestHeaders(),
                        body: JSON.stringify({
                            path,
                            file: reader.result,
                        }),
                    });
                    if (!putResponse.ok) {
                        alert('something went wrong');
                        btn.style.color = '';
                        return;
                    }
                    finalPath = `~/user/STEE/${(await putResponse.json()).name}`;

                    // launch snippet file in local editor
                    const openResponse = await fetch('/api/plugins/files/open', {
                        method: 'POST',
                        headers: getRequestHeaders(),
                        body: JSON.stringify({
                            path: finalPath,
                        }),
                    });
                    if (!openResponse.ok) {
                        alert('something went wrong');
                        btn.style.color = '';
                        return;
                    }

                    // watch snippet file
                    isWatching = true;
                    Promise.resolve().then(async()=>{
                        while (isWatching) {
                            if (!ta.closest('body')) {
                                stop();
                                break;
                            }
                            await delay(200);
                        }
                    });
                    while (isWatching) {
                        const watchResponse = await fetch('/api/plugins/files/watch', {
                            method: 'POST',
                            headers: getRequestHeaders(),
                            body: JSON.stringify({
                                path: finalPath,
                                interval: 200,
                            }),
                        });
                        if (!watchResponse.ok) {
                            alert('something went wrong');
                            btn.style.color = '';
                            return;
                        }
                        ta.value = await watchResponse.text();
                        ta.dispatchEvent(new Event('input', { bubbles:true }));
                    }
                    const delResponse = await fetch('/api/plugins/files/delete', {
                        method: 'POST',
                        headers: getRequestHeaders(),
                        body: JSON.stringify({
                            path: finalPath,
                        }),
                    });
                    if (!delResponse.ok) {
                        alert('something went wrong');
                        btn.style.color = '';
                        return;
                    }
                    btn.style.color = '';
                });
                layer.append(btn);
            }
        });
        ta.addEventListener('blur', ()=>{
            btn?.remove();
            btn = null;
        });
    }
};
addBtn();
const mo = new MutationObserver(debounce(addBtn));
mo.observe(document.body, { childList:true, subtree:true, attributes:true });
