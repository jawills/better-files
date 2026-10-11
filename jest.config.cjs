const { jestConfig } = require("@salesforce/sfdx-lwc-jest/config");

module.exports = {
  ...jestConfig,
  modulePathIgnorePatterns: ["<rootDir>/.localdevserver", "<rootDir>/react/"],
  moduleNameMapper: {
    ...jestConfig.moduleNameMapper,
    "^lightning/refresh$":
      "<rootDir>/force-app/test/jest-mocks/lightning/refresh.js"
  }
};
