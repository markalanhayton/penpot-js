import '../components/base.js';
import '../components/penpot-icon.js';
import '../components/penpot-loader.js';
import '../components/penpot-badge.js';
import '../components/penpot-button.js';
import '../components/penpot-input.js';
import '../components/penpot-checkbox.js';
import '../components/penpot-radio.js';
import '../components/penpot-switch.js';
import '../components/penpot-slider.js';
import '../components/penpot-tooltip.js';
import '../components/penpot-tabs.js';
import '../components/penpot-dropdown.js';
import '../components/penpot-modal.js';
import '../components/penpot-select.js';
import '../components/penpot-notification.js';
import '../components/penpot-avatar.js';
import '../components/penpot-file-thumbnail.js';
import '../components/penpot-form.js';
import '../components/penpot-context-menu.js';
import '../components/penpot-color-picker.js';
import { info, success, warning, danger } from '../components/penpot-notification.js';

function esc(s) { const el = document.createElement('span'); el.textContent = s || ''; return el.innerHTML; }

const app = document.getElementById('app');

app.innerHTML = `
  <h1>Penpot Design System</h1>
  <p style="color:var(--penpot-text-dim);font-size:var(--penpot-font-size-m);margin-bottom:var(--penpot-spacing-xxxl);">
    Component preview page — matches original Penpot dark theme.
  </p>

  <h2>Colors</h2>
  <div class="section">
    <h3>Accent Colors</h3>
    <div class="colors">
      <div class="color-swatch"><div class="swatch" style="background:var(--penpot-accent)"></div><div class="name">accent</div></div>
      <div class="color-swatch"><div class="swatch" style="background:var(--penpot-accent-secondary)"></div><div class="name">secondary</div></div>
      <div class="color-swatch"><div class="swatch" style="background:var(--penpot-accent-tertiary)"></div><div class="name">tertiary</div></div>
      <div class="color-swatch"><div class="swatch" style="background:var(--penpot-accent-action)"></div><div class="name">action</div></div>
      <div class="color-swatch"><div class="swatch" style="background:var(--penpot-primary)"></div><div class="name">primary</div></div>
    </div>
    <h3>Semantic</h3>
    <div class="colors">
      <div class="color-swatch"><div class="swatch" style="background:var(--penpot-success)"></div><div class="name">success</div></div>
      <div class="color-swatch"><div class="swatch" style="background:var(--penpot-warning)"></div><div class="name">warning</div></div>
      <div class="color-swatch"><div class="swatch" style="background:var(--penpot-danger)"></div><div class="name">danger</div></div>
      <div class="color-swatch"><div class="swatch" style="background:var(--penpot-info)"></div><div class="name">info</div></div>
    </div>
    <h3>Backgrounds</h3>
    <div class="colors">
      <div class="color-swatch"><div class="swatch" style="background:var(--penpot-bg)"></div><div class="name">bg</div></div>
      <div class="color-swatch"><div class="swatch" style="background:var(--penpot-surface);border:1px solid var(--penpot-border)"></div><div class="name">surface</div></div>
      <div class="color-swatch"><div class="swatch" style="background:var(--penpot-surface-high)"></div><div class="name">surface-high</div></div>
      <div class="color-swatch"><div class="swatch" style="background:var(--penpot-surface-highest)"></div><div class="name">surface-highest</div></div>
      <div class="color-swatch"><div class="swatch" style="background:var(--penpot-input-bg)"></div><div class="name">input-bg</div></div>
    </div>
    <h3>Text</h3>
    <div class="colors">
      <div class="color-swatch"><div class="swatch" style="background:var(--penpot-text)"></div><div class="name">text</div></div>
      <div class="color-swatch"><div class="swatch" style="background:var(--penpot-text-dim)"></div><div class="name">text-dim</div></div>
      <div class="color-swatch"><div class="swatch" style="background:var(--penpot-text-disabled)"></div><div class="name">text-disabled</div></div>
    </div>
  </div>

  <h2>Buttons</h2>
  <div class="section">
    <div class="row">
      <penpot-button variant="primary" size="m">Primary</penpot-button>
      <penpot-button size="m">Secondary</penpot-button>
      <penpot-button variant="danger" size="m">Danger</penpot-button>
      <penpot-button variant="ghost" size="m">Ghost</penpot-button>
    </div>
    <h3>Sizes</h3>
    <div class="row">
      <penpot-button variant="primary" size="s">Small</penpot-button>
      <penpot-button variant="primary" size="m">Medium (default)</penpot-button>
      <penpot-button variant="primary" size="l">Large</penpot-button>
    </div>
    <h3>States</h3>
    <div class="row">
      <penpot-button variant="primary">Normal</penpot-button>
      <penpot-button variant="primary" disabled>Disabled</penpot-button>
      <penpot-button variant="primary" loading>Loading</penpot-button>
    </div>
  </div>

  <h2>Inputs</h2>
  <div class="section">
    <div class="row" style="flex-direction:column;align-items:flex-start;gap:var(--penpot-spacing-m);max-width:320px;">
      <penpot-input label="Email" type="email" placeholder="you@example.com" name="email"></penpot-input>
      <penpot-input label="Password" type="password" placeholder="Enter password" name="pw"></penpot-input>
      <penpot-input label="With error" type="text" error="This field is required" name="err"></penpot-input>
      <penpot-input label="Disabled" type="text" disabled value="Can't edit" name="dis"></penpot-input>
    </div>
  </div>

  <h2>Checkbox & Switch</h2>
  <div class="section">
    <div class="row" style="flex-direction:column;align-items:flex-start;gap:var(--penpot-spacing-m);">
      <penpot-checkbox>Accept terms</penpot-checkbox>
      <penpot-checkbox checked>Subscribe to newsletter</penpot-checkbox>
      <penpot-checkbox disabled>Disabled option</penpot-checkbox>
    </div>
    <h3>Switch</h3>
    <div class="row" style="flex-direction:column;align-items:flex-start;gap:var(--penpot-spacing-m);">
      <penpot-switch>Enable notifications</penpot-switch>
      <penpot-switch checked>Dark mode</penpot-switch>
      <penpot-switch disabled>Disabled</penpot-switch>
    </div>
  </div>

  <h2>Radio</h2>
  <div class="section">
    <penpot-radio value="blue">
      <penpot-radio-option value="blue" label="Blue"></penpot-radio-option>
      <penpot-radio-option value="green" label="Green"></penpot-radio-option>
      <penpot-radio-option value="red" label="Red"></penpot-radio-option>
    </penpot-radio>
  </div>

  <h2>Slider</h2>
  <div class="section">
    <div style="max-width:300px;">
      <penpot-slider min="0" max="100" value="50" step="1"></penpot-slider>
    </div>
    <h3>Opacity</h3>
    <div style="max-width:300px;">
      <penpot-slider min="0" max="1" value="0.75" step="0.01"></penpot-slider>
    </div>
  </div>

  <h2>Badges</h2>
  <div class="section">
    <div class="row">
      <penpot-badge>Default</penpot-badge>
      <penpot-badge variant="primary">Primary</penpot-badge>
      <penpot-badge variant="success">Success</penpot-badge>
      <penpot-badge variant="warning">Warning</penpot-badge>
      <penpot-badge variant="danger">Danger</penpot-badge>
      <penpot-badge variant="info">Info</penpot-badge>
    </div>
  </div>

  <h2>Icons</h2>
  <div class="section">
    <div class="row">
      <penpot-icon name="plus" size="20px"></penpot-icon>
      <penpot-icon name="check" size="20px"></penpot-icon>
      <penpot-icon name="cross" size="20px"></penpot-icon>
      <penpot-icon name="search" size="20px"></penpot-icon>
      <penpot-icon name="settings" size="20px"></penpot-icon>
      <penpot-icon name="arrow_left" size="20px"></penpot-icon>
      <penpot-icon name="edit" size="20px"></penpot-icon>
      <penpot-icon name="trash" size="20px"></penpot-icon>
      <penpot-icon name="eye" size="20px"></penpot-icon>
      <penpot-icon name="zoom_in" size="20px"></penpot-icon>
      <penpot-icon name="zoom_out" size="20px"></penpot-icon>
      <penpot-icon name="share" size="20px"></penpot-icon>
      <penpot-icon name="download" size="20px"></penpot-icon>
      <penpot-icon name="more" size="20px"></penpot-icon>
    </div>
  </div>

  <h2>Loader</h2>
  <div class="section">
    <div class="row">
      <penpot-loader size="18px"></penpot-loader>
      <penpot-loader size="24px"></penpot-loader>
      <penpot-loader size="36px"></penpot-loader>
      <penpot-loader size="48px" color="var(--penpot-accent)"></penpot-loader>
    </div>
  </div>

  <h2>Tooltip</h2>
  <div class="section">
    <div class="row">
      <penpot-tooltip text="Bottom tooltip"><penpot-button size="s">Bottom</penpot-button></penpot-tooltip>
      <penpot-tooltip text="Top tooltip" position="top"><penpot-button size="s">Top</penpot-button></penpot-tooltip>
      <penpot-tooltip text="Left tooltip" position="left"><penpot-button size="s">Left</penpot-button></penpot-tooltip>
      <penpot-tooltip text="Right tooltip" position="right"><penpot-button size="s">Right</penpot-button></penpot-tooltip>
    </div>
  </div>

  <h2>Tabs</h2>
  <div class="section">
    <penpot-tabs selected="0">
      <penpot-tab-panel label="General">General settings content here.</penpot-tab-panel>
      <penpot-tab-panel label="Advanced">Advanced settings content here.</penpot-tab-panel>
      <penpot-tab-panel label="About">About panel content here.</penpot-tab-panel>
    </penpot-tabs>
  </div>

  <h2>Dropdown</h2>
  <div class="section">
    <div class="row">
      <penpot-dropdown placeholder="Choose...">
        <penpot-dropdown-item value="opt1" label="Option 1"></penpot-dropdown-item>
        <penpot-dropdown-item value="opt2" label="Option 2"></penpot-dropdown-item>
        <penpot-dropdown-item value="opt3" label="Option 3"></penpot-dropdown-item>
      </penpot-dropdown>
    </div>
  </div>

  <h2>Select</h2>
  <div class="section">
    <div style="max-width:240px;">
      <penpot-select placeholder="Select size..." name="size">
        <option value="s">Small</option>
        <option value="m">Medium</option>
        <option value="l">Large</option>
      </penpot-select>
    </div>
  </div>

  <h2>Notifications</h2>
  <div class="section">
    <div class="row">
      <penpot-button variant="ghost" size="s" id="notif-info">Info</penpot-button>
      <penpot-button variant="ghost" size="s" id="notif-success">Success</penpot-button>
      <penpot-button variant="ghost" size="s" id="notif-warning">Warning</penpot-button>
      <penpot-button variant="ghost" size="s" id="notif-danger">Danger</penpot-button>
    </div>
  </div>

  <h2>Modal</h2>
  <div class="section">
    <penpot-button id="open-modal">Open Modal</penpot-button>
    <penpot-modal id="demo-modal" title="Demo Modal" size="medium">
      <p>This is a modal dialog. It has a title, content area, and footer.</p>
    </penpot-modal>
  </div>

  <h2>Avatar</h2>
  <div class="section">
    <div class="row">
      <penpot-avatar name="John Doe" size="s"></penpot-avatar>
      <penpot-avatar name="Jane Smith" size="m"></penpot-avatar>
      <penpot-avatar name="AB" size="l"></penpot-avatar>
      <penpot-avatar name="CD" size="xl"></penpot-avatar>
    </div>
  </div>

  <h2>File Thumbnail</h2>
  <div class="section">
    <div class="row">
      <div style="width:160px;"><penpot-file-thumbnail name="My Design" type="file"></penpot-file-thumbnail></div>
      <div style="width:160px;"><penpot-file-thumbnail name="Project" type="project"></penpot-file-thumbnail></div>
    </div>
  </div>

  <h2>Color Picker</h2>
  <div class="section">
    <div style="width:220px;">
      <penpot-color-picker value="#31efb8"></penpot-color-picker>
    </div>
  </div>

  <h2>Context Menu</h2>
  <div class="section">
    <penpot-button id="ctx-btn">Right-click me</penpot-button>
    <penpot-context-menu id="ctx-menu"></penpot-context-menu>
  </div>

  <h2>Form</h2>
  <div class="section">
    <penpot-form id="demo-form" style="max-width:400px;">
      <penpot-input label="Name" type="text" placeholder="Your name" name="name"></penpot-input>
      <penpot-input label="Email" type="email" placeholder="you@example.com" name="email"></penpot-input>
    </penpot-form>
    <penpot-button variant="primary" size="m" id="form-submit">Submit</penpot-button>
  </div>
`;

document.getElementById('notif-info').addEventListener('penpot-button-click', () => info('This is an info message.'));
document.getElementById('notif-success').addEventListener('penpot-button-click', () => success('Operation completed successfully!'));
document.getElementById('notif-warning').addEventListener('penpot-button-click', () => warning('Something might be wrong.'));
document.getElementById('notif-danger').addEventListener('penpot-button-click', () => danger('An error occurred.'));

document.getElementById('open-modal').addEventListener('penpot-button-click', () => {
  document.getElementById('demo-modal').open();
});

const ctxBtn = document.getElementById('ctx-btn');
const ctxMenu = document.getElementById('ctx-menu');
ctxMenu.items = [
  { label: 'Cut', shortcut: 'Ctrl+X', action: () => info('Cut') },
  { label: 'Copy', shortcut: 'Ctrl+C', action: () => info('Copied!') },
  { label: 'Paste', shortcut: 'Ctrl+V', action: () => info('Pasted') },
  { type: 'separator' },
  { label: 'Delete', danger: true, action: () => danger('Deleted') },
];
ctxBtn.addEventListener('contextmenu', (e) => ctxMenu.showAtEvent(e));

document.getElementById('form-submit').addEventListener('penpot-button-click', () => {
  const form = document.getElementById('demo-form');
  const valid = form.validate();
  if (valid) success('Form is valid!');
});