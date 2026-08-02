import antfu from '@antfu/eslint-config'
import vuejsAccessibility from 'eslint-plugin-vuejs-accessibility'

export default antfu(
  {
    formatters: {
      css: 'prettier',
      prettierOptions: {
        printWidth: 120,
        singleQuote: false,
      },
    },
    rules: {
      'vue/max-attributes-per-line': [
        'error',
        {
          singleline: {
            max: 5,
          },
          multiline: {
            max: 5,
          },
        },
      ],
      'no-alert': 'off',
      'style/quote-props': 'off',
    },
    eslint: {
      ignorePatterns: [
        'dist',
        'node_modules',
        'public',
        '.output',
        '.wxt',
      ],
    },
  },
  {
    files: ['src/components/Settings/BewlyPages/Moments/**/*.vue'],
    plugins: {
      'vuejs-accessibility': vuejsAccessibility,
    },
    rules: vuejsAccessibility.configs['flat/recommended'][1].rules,
  },
)
