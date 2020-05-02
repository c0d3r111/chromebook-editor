const create = COMPOSER.export();
const css    = {
  focus   (selector, hash) {
    return Object.assign(this, {
      sheet    : "",
      selector : hash ? "#" + selector : selector,
      end() {
        return this.selector + ' {' + this.sheet.trim() + '}';
      }
    });
  },
  add     (property, value) {
    this.sheet += (property.trim() + ':' + value.trim() + ';');

    return this;
  },
  media   (sheet) {
    if (typeof sheet === 'function') {
      this.sheet = sheet();
    }
    else {
      this.sheet = sheet;
    }

    return this;
  },
  include (selector) {
    const focus = Object.assign({}, this);
    
    focus.selector = selector;
    focus.sheet    = '';

    return focus;
  }
};
const view   = {
  settings: {
    color_highlight  : '#d6be2b',
    color_background : '#0C1021',
    pingurl          : '', 
  },
  dirs    : Object.create(null),
  hashes  : Object.create(null),
  ids     : new Proxy(Object.create(null), {
    get(obj, property) {
      if (!(property in obj)) {
        obj[property] = "_" + (Math.random()).toString(24).replace(/[^\w]/g, '');
      }
      
      return obj[property];
    }
  }),
  barebones  (name) {
    return {
      wrapper : create('section'),
      body    : create('div').id(this.ids[name]),
      style   : create('style'),
      end     : function() {
        return this.wrapper.add([this.style, this.body]);
      }
    };
  },
  base       () {
    const head   = create(document.head);
    const style  = create('style');
    
    void style
    .append(css.focus('body, html')
      .add('margin', '0')
      .add('padding', '0')
      .add('height', '100px')
      .add('width' , '100%')
      .add('background', this.settings.color_background)
      .add('color', 'white')
      .add('font-family', "'PT Mono', monospace")
    .end())
    .append(css.focus('*')
      .add('box-sizing', 'border-box')
    .end())
    .append(css.focus('button')
      .add('padding', '10px 20px')
      .add('border', 'none')
      .add('border-radius', '0.15em')
      .add('border', '1px solid white')
      .add('outline', 'none')
      .add('height', '40px')
      .add('background', 'transparent')
      .add('text-transform', 'uppercase')
      .add('color', 'white')
    .end())
    .append(css.focus('.activefile')
      .add('color', this.settings.color_highlight)
    .end())
    .append(css.focus('.cursor, li')
      .add('cursor', 'pointer')
      .add('user-select', 'none')
    .end())
    .append(css.focus('.icon')
      .add('font-size', '22px')
      .add('font-weight', 'bold')
    .end())
    .append(css.focus('.flex')
      .add('display', 'flex')
      .add('align-items', 'center')
    .end())
    .append(css.focus('.successbox')
      .add('position', 'fixed')
      .add('bottom', '1em')
      .add('right', '1em')
      .add('background', this.settings.color_highlight)
      .add('color', 'white')
      .add('padding', '10px 20px')
      .add('border-radius', '0.25em')
    .end())
    .append(css.focus('.hidden')
      .add('display', 'none')
    .end());
    void head.add(style);
    
    return this;
  },
  clean      () {
    const dirs = window.localStorage.getItem('loadeddirs');
    const code = window.localStorage.getItem('accesscode');
    
    void window.localStorage.clear();
    void window.localStorage.setItem('accesscode', code);
    void window.localStorage.setItem('loadeddirs', dirs);
    
    return;
  },
  createfile () {
    const path = this.name + prompt('Path for new file?');
    const list = create(document.querySelector(`#${this.that.ids[this.name]} ul`));
    const li   = this.that.newfile({path}, this.name);
    
    void list.add(li);
    void this.that.monaco.setValue("");
    
    this.that.activefile = li.element.id;
    this.that.activepath = path;
    this.that.setactive(li.element.id);
    
    return;
  },
  deldir     (name) {
    try {
      const dirs = new Set(JSON.parse(window.localStorage.getItem('loadeddirs')));
      
      void dirs.delete(name);
      void window.localStorage.setItem('loadeddirs', JSON.stringify(Array.from(dirs)));
    }
    finally {
      return;
    }
  },
  editor     () {
    void monaco.editor.defineTheme('vibrant', window.THEME);
    void monaco.editor.setTheme('vibrant');
    
    this.monaco = monaco.editor.create(document.getElementById(this.ids.editor), {
      language  : 'javascript',
      fontSize  : 17,
      tabSize   : 2,
      minimap   : {
        enabled: false,
      }
    });
    
    void this.monaco.onDidFocusEditorText(function() {
      this.paused = false;
    }.bind(this));
    void window.addEventListener('blur', async function() {
      this.paused = true;
      this.savestate();
    }.bind(this));
    
    return;
  },
  getheight  (name) {
    return document.getElementById(this.ids[name]).offsetHeight;
  },
  getwidth   (name) {
    return document.getElementById(this.ids[name]).offsetWidth;
  },
  getfiles   (_dir)  {
    const dir    = this.normalize(_dir);
    const that   = this.dropbox;

    return new Promise(function(resolve) {
      that.filesListFolder({path: dir, recursive: true, include_media_info: true})
        .then(data => {
          if (!data.entries) resolve([]);
          
          const list = [];
          
          for (let entry of data.entries) {
            if (entry['.tag'] !== 'file') continue;
            
            void list.push({
              name: entry.name.toLowerCase(),
              path: entry.path_lower,
              hash: entry.content_hash,
              time: (new Date(entry.content_modified)).getTime()
            });
          }
          
          resolve(list);
        })
        .catch(() => resolve([]));
    });
  },
  loadfile   (_path) {
    if (this.saving) {
      return void setTimeout(this.loadfile.bind(this), 500);
    }
    
    if (window.localStorage.hasOwnProperty(_path)) {
      void this.monaco.setValue(window.localStorage.getItem(_path));
      
      return;
    }
    
    const path = _path;
    const that = this;

    return new Promise(function(resolve) {
      that.dropbox.filesDownload({path})
        .then(data => {
          if (!data.fileBlob) resolve();
          
          Promise.resolve(data.fileBlob.text())
            .then(content => {
              void window.localStorage.setItem(path, content);
              void that.monaco.setValue(content);
              // void that.monaco.session.foldAll();
              
              resolve();
            });
        })
        .catch(alert);
    });
  },
  loadstate  () {
    try {
      let state = JSON.parse(window.localStorage.getItem('state'));
      let lis   = Array.from(document.querySelectorAll(`#${this.ids.panel} li`));
      let node  = false;
      let path  = state.path.replace(state.dir, '');

      for (let li of lis) {
        if (li.innerText === path) {
          node = li;
          
          break;
        }    
      }
      
      if (!node) return;
      
      this.activedir  = state.dir;
      this.activepath = state.path;
      this.activefile = node.id;
        
      void this.setactive(node.id);
      void this.monaco.setValue(state.content);
      
      this.paused = false;
    }
    catch(err) {
      console.log(err);
    }
    
    return;
  },
  main       () {
    const section = this.barebones('editor');
    
    void section.style.append(css.focus(this.ids.editor, true)
      .add('top', '10px')
      .add('left', this.getwidth('panel') + 'px')
      .add('height', 'calc(100% - 20px)')
      .add('width', `calc(100% - ${this.getwidth('panel') + 15}px)`)
      .add('position', 'fixed')
      .add('padding', '1em 0')
    .end());
    
    return section.end();
  },
  newfile    (data, name) {
    return create('li')
      .id(this.ids[data.path])
      .text(data.path.replace(name, ''))
      .click(function(e) {
        const element = e.target || e.srcElement;
        
        this.that.activefile = element.id;
        this.that.activedir  = this.name;
        this.that.activepath = this.path;
        
        void this.that.setactive(element.id);
        void this.that.monaco.setValue("");
        void this.that.loadfile(this.path);
      }.bind({that: this, name, path: data.path}));
  },
  normalize  (dir) {
   let path = dir[0] === '/' ? dir : '/' + dir;
       path = path.endsWith('/') ? path : path + '/';
       
    return path;
  },
  panel      () {
    const section = this.barebones('panel');
    const width   = 300;
    
    void section.style.append(css.focus(this.ids.panel, true)
      .add('height', '100%')
      .add('width', width + 'px')
      .add('top', '0')
      .add('position', 'fixed')
      .add('padding-top', '1em')
      .add('border-right', '1px solid white')
    .end())
    .append(css.focus(`#${this.ids.panel} p:hover`)
      .add('color', this.settings.color_highlight)
    .end());
    void section.body.add([
      create().names('flex').style({
        justifyContent: "space-around",
        textTransform: "uppercase",
        marginBottom: "0.5em",
        overflow: 'auto',
      }).add([
        create('p').names('cursor').text('New').id(this.ids.dirbutton).click(this.newdir.bind(this)),
        create('p').names('cursor').text('Delete').id(this.ids.delbtton).click(this.removefile.bind(this)),
        create('p').names('cursor').text('Save').id(this.ids.setbutton).click(this.save.bind(this)),
      ])
    ])
    
    return section.end();
  },
  ping       () {
    const url = this.settings.pingurl;

    return new Promise(function(resolve) {
      void fetch(url).then(resolve);
    });
  },
  removedir  () {
    if (!this.name) return;
    if (!confirm('Are you sure you want to remove: ' + this.name + '?')) return;

    void this.that.deldir(this.name);
    void document.getElementById(this.that.ids[this.name]).remove();
    
    return;
  },
  removefile () {
    if (!this.activepath) return;
    if (!confirm('Are you sure you want to delete: ' + this.activepath + '?')) return;
    
    const path = this.activepath;
    const that = this;
    
    new Promise(function(resolve) {
      that.dropbox.filesDelete({path})
        .then(resp => {
          if (resp.content_hash) {
            void window.localStorage.removeItem(path);
            void document.getElementById(that.ids[path]).remove();
            void that.monaco.setValue("");
            
            that.activepath = false;
          }
        })
        .catch(console.log);
    });
  },
  save       () {
    if (!this.activepath) return;
    
    this.saving    = true;

    const contents = this.encoder.encode(this.monaco.getValue());
    const path     = this.activepath;
    const that     = this;
    
    return new Promise(function(resolve) {
      void that.dropbox.filesUpload({path, contents, mode: {".tag": 'overwrite'}})
        .then(resp => {
          if (resp.content_hash) {
            void window.localStorage.removeItem(path);
            void window.localStorage.setItem(path, that.monaco.getValue());
            void that.success.call(that);
          }
        })
        .finally(() => {
          that.saving = false;
          
          void resolve();
        });
    });
  },
  savestate  () {
    if (this.activepath) {
      void window.localStorage.setItem('state', JSON.stringify({
        path    : this.activepath,
        dir     : this.activedir,
        content : this.monaco.getValue(),
      }));
    }
    
    return;
  },
  setdir     (name) {
    let dirs = window.localStorage.getItem('loadeddirs');
    
    if (!dirs) {
      dirs = [];
    }
    else {
      dirs = JSON.parse(dirs);
    }
    
    void dirs.push(name);
    void window.localStorage.setItem('loadeddirs', JSON.stringify(Array.from(new Set(dirs))));
    
    return;
  },
  setactive  (id)   {
    const lis    = Array.from(document.querySelectorAll(`#${this.ids.panel} li`));
    const target = document.getElementById(id);
    
    for (let li of lis) {
      void li.classList.remove('activefile');
    }
    
    void target.classList.add('activefile');
    
    return;
  },
  sleep      (time) {
    return new Promise(function(resolve) {
      void setTimeout(resolve, time || 1e3);
    });
  },
  success    () {
    let box = create('p').names('successbox').text('Your last action has successfully completed.');
    
    void this.ping.call(this);
    void document.body.appendChild(box.element);
    void setTimeout(function() {
      void box.element.remove();
      
      box = null;
    }, 2e3);
    
    return;
  },
  async autostate () {
    if (!this.paused && this.activepath) {
      void this.savestate();
    }
    
    await this.sleep(3e3);
    
    return this.autostate();
  },
  async newdir    (name) {
    if (!name || typeof name === 'object') {
      name = this.normalize(prompt('What directory would you like to load?'));
    }
    
    const wrapper   = create().id(this.ids[name]);
    const list      = create('ul').names('cursor');
    const files     = await this.getfiles(name);

    this.dirs[name] = this.ids[name];
 
    for (let file of files) {
      void list.add(this.newfile(file, name));
    }
    
    void wrapper.style({
      padding: '0.5em 1em 0.5em',
      marginBottom: '-1em',
    });
    void wrapper.add([
      create().names('flex').add([
        create('h3').names('cursor').text(name).style({margin: '0 auto 0 0'}).click(function() {
          const node = document.querySelector(`#${this.ids[this.name]} ul`);

          if (node) void node.classList.toggle('hidden');

          return;
        }.bind({ids: this.ids, name: name})),
        create('span')
          .text('+').names('cursor icon')
          .style({marginRight: '0.75em'})
          .click(this.createfile.bind({that: this, name})),
        create('span')
          .text('-').names('cursor icon')
          .click(this.removedir.bind({that: this, name})),
      ]),
      list
    ]);
    void create(document.getElementById(this.ids.panel)).add(wrapper);
    void this.setdir(name);
    
    return;
  },
  async page      () {
    let body = create(document.body);
    
    if (window.localStorage.hasOwnProperty('accesscode')) {
      const password  = prompt('Access password? (Will not be saved!)');
      const decrypted = CryptoJS.AES.decrypt(window.localStorage.getItem('accesscode'), password);
      
      this.dropbox    = new Dropbox.Dropbox({accessToken: decrypted.toString(CryptoJS.enc.Utf8), fetch});
    }
    else {
      const code      = prompt('Dropbox access code? (Will be encrypted and saved to localStorage)');
      const password  = prompt('Access password? (Will not be saved!)');
      const encrypted = CryptoJS.AES.encrypt(code, password).toString();
      
      void window.localStorage.setItem('accesscode', encrypted);
      
      this.dropbox    = new Dropbox.Dropbox({accessToken: code, fetch});
    }
    
    void this.base();
    void body.add(this.panel());
    void body.add(this.main());
    void this.editor();
    
    if (window.localStorage.hasOwnProperty('loadeddirs')) {
      const dirs  = Array.from(new Set(JSON.parse(window.localStorage.getItem('loadeddirs'))));
      const batch = dirs.map(this.newdir.bind(this));
      
      await Promise.all(batch);
    }
    
    this.encoder = new TextEncoder();
    this.paused  = true;
    
    void document.addEventListener("keydown", function(e) {
      if (e.ctrlKey && e.keyCode == 83) {
        void e.preventDefault();
        void this.save()
      }
    }.bind(this), false);
    void this.loadstate();
    void view.autostate();

    return;
  },
};

void require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.20.0/min/vs' }});
void require(['vs/editor/editor.main'], () => void view.page());

view.pingurl = prompt('Enter server sync url:');
