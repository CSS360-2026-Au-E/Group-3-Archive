
const { expect } = require("chai");
const fc = require("fast-check");

const { safeName } = require("../src/logsys/logUtils");

describe("Fuzz testing - safeName()", function () {
  it("should always return a non-empty string", function () {
    fc.assert(
      fc.property(fc.anything(), (input) => {
        const result = safeName(input);

        expect(result).to.be.a("string");
        expect(result.length).to.be.greaterThan(0);
      })
    );
  });

  it("should replace unsafe filename characters", function () {
    fc.assert(
      fc.property(fc.string(), (input) => {
        const result = safeName(input);

        expect(result).to.not.match(/[<>:"/\\|?*\p{Cc}]/u);
      })
    );
  });

  it("should not return directory traversal names", function () {
    fc.assert(
      fc.property(fc.constant(".."), (input) => {
        const result = safeName(input);

        expect(result).to.not.equal("..");
      })
    );
  });
});
