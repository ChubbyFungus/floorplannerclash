/** @type {import('dependency-cruiser').IConfiguration} */
const config = {
  forbidden: [
    {
      name: 'no-three-outside-infra',
      severity: 'error',
      comment: 'Three.js imports must be isolated to infra/three-viewer.',
      from: {
        pathNot: [
          'infra/three-viewer',
          'components/editor/Blueprint3D', // DEBT:KILLDATE=2025-11-05
          'types/', // Type definitions are OK
          '__tests__', // Test files
          '.test.',
          '.spec.',
          '.d.ts$', // TypeScript declaration files
          'tests/' // Test setup files
        ]
      },
      to: {
        path: '^node_modules/three',
        pathNot: [
          '^node_modules/@react-three' // react-three-fiber is allowed for Canvas components
        ]
      }
    },
    {
      name: 'no-domain-in-ui',
      severity: 'error',
      comment: 'UI components must not import domain logic directly.',
      from: {
        path: '^src/(components|pages)'
      },
      to: {
        path: '^src/domain'
      }
    }
  ],
  options: {
    doNotFollow: {
      path: 'node_modules'
    },
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: './tsconfig.json'
    },
    reporterOptions: {
      text: {
        highlightFocused: true
      }
    }
  }
};

export default config;

