/**
 * Monaco Editor Manager for CodeArena
 */
class MonacoManager {
  constructor() {
    this.editor = null;
    this.isApplyingRemoteUpdate = false;
    this.remoteDecorations = [];
    this.onRunCallback = null;
    this.currentLanguage = 'javascript';
  }

  init(containerId, initialCode = '// Start coding here...\n', language = 'javascript') {
    return new Promise((resolve) => {
      this.currentLanguage = language;
      // Configure Monaco loader
      require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' } });

      require(['vs/editor/editor.main'], () => {
        // Define custom dark theme
        monaco.editor.defineTheme('codearena-dark', {
          base: 'vs-dark',
          inherit: true,
          rules: [
            { token: 'comment', foreground: '6b7280', fontStyle: 'italic' },
            { token: 'keyword', foreground: '818cf8', fontStyle: 'bold' },
            { token: 'string', foreground: '34d399' },
            { token: 'number', foreground: 'f59e0b' }
          ],
          colors: {
            'editor.background': '#0f172a',
            'editor.foreground': '#e2e8f0',
            'editor.lineHighlightBackground': '#1e293b66',
            'editorCursor.foreground': '#6366f1',
            'editorWhitespace.foreground': '#334155',
            'editorLineNumber.foreground': '#475569',
            'editorLineNumber.activeForeground': '#94a3b8'
          }
        });

        const container = document.getElementById(containerId);
        if (!container) return;

        this.editor = monaco.editor.create(container, {
          value: initialCode,
          language: this.currentLanguage,
          theme: 'codearena-dark',
          automaticLayout: true,
          fontSize: 14,
          fontFamily: "'Fira Code', monospace",
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          renderWhitespace: 'selection',
          padding: { top: 12, bottom: 12 }
        });

        // Keyboard Shortcut: Ctrl+Enter / Cmd+Enter to Run Code
        this.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
          if (this.onRunCallback) this.onRunCallback();
        });

        // Setup Cursor Change Listener
        this.editor.onDidChangeCursorPosition((e) => {
          if (window.realtime && window.currentInterviewId) {
            window.realtime.sendCursorMove(window.currentInterviewId, {
              lineNumber: e.position.lineNumber,
              column: e.position.column
            });
          }
        });

        resolve(this.editor);
      });
    });
  }

  getCode() {
    return this.editor ? this.editor.getValue() : '';
  }

  setCode(code) {
    if (!this.editor) return;
    this.isApplyingRemoteUpdate = true;
    const currentPosition = this.editor.getPosition();
    this.editor.setValue(code);
    if (currentPosition) {
      this.editor.setPosition(currentPosition);
    }
    this.isApplyingRemoteUpdate = false;
  }

  setLanguage(lang) {
    if (!this.editor) return;
    this.currentLanguage = lang;
    monaco.editor.setModelLanguage(this.editor.getModel(), lang);
  }

  setRemoteCursor(position, userName, role) {
    if (!this.editor) return;
    // Show remote cursor marker as decoration
    const color = role === 'INTERVIEWER' ? '#c084fc' : '#38bdf8';

    this.remoteDecorations = this.editor.deltaDecorations(this.remoteDecorations, [
      {
        range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column + 1),
        options: {
          className: 'remote-cursor-decoration',
          hoverMessage: { value: `${userName} (${role})` }
        }
      }
    ]);
  }

  onContentChange(callback) {
    if (!this.editor) return;
    this.editor.onDidChangeModelContent((event) => {
      if (this.isApplyingRemoteUpdate) return;
      const code = this.editor.getValue();
      callback(code, event.changes);
    });
  }
}

window.codeEditor = new MonacoManager();
