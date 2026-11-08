// Known defects that cannot be fixed in this repository, because files they need are not in it.
// The specs fail on any other problem, and on any entry here that no longer occurs, so this list stays accurate.
// Each entry is a substring of the reported problem.

const KNOWN_PAGE_ISSUES = {
  '/s2/dynamic2.html': ['dynamic1/'], // Word-export images from a dynamic1/ folder that is not in the repo
  '/s2/perebor.html': ['Info2.3.0/'], // images from an Info2.3.0/ folder that is not in the repo
  '/s3/cpp.html': ['a.cpp'], // the sample a.cpp that the page loads is not in the repo
  '/s3/cpp11.html': ['a.cpp'],
  '/s3/cpp_3.html': ['a.cpp'],
  '/s3/cpp_stl.html': ['a.cpp'],
  '/s3/segments_tree.html': ['segments_tree/1.png', 'segments_tree/6.png'], // missing pictures
  '/s3/dynamic/dynamic_comb.htm': ['img3.png', 'img.png', 'img2.png'], // missing pictures
};

const KNOWN_FORMULA_ISSUES = {
  // Broken Word export: the formulas are split by tags and have a space before the closing $, so MathJax skips them.
  '/s3/dynamic/dynamic_comb.htm': ['$_i  $'],
};

module.exports = { KNOWN_PAGE_ISSUES, KNOWN_FORMULA_ISSUES };
