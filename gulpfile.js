var gulp = require("gulp");
var browserify = require("browserify");
var buffer = require("vinyl-buffer");
var fancy_log = require("fancy-log");
var source = require("vinyl-source-stream");
var sourcemaps = require("gulp-sourcemaps");
var terser = require("gulp-terser");
var tsify = require("tsify");
var watchify = require("watchify");

var paths = {
  pages: ["src/*.html", "src/*.css", "src/images/favicon/*"],
};

var watchedBrowserify = watchify(
  browserify({
    basedir: ".",
    debug: true,
    entries: ["src/script.ts"],
    cache: {},
    packageCache: {},
  }).plugin(tsify)
);

function bundle() {
  return watchedBrowserify
    .bundle()
    .on("error", fancy_log)
    .pipe(source("bundle.js"))
    .pipe(buffer())
    .pipe(sourcemaps.init({ loadMaps: true }))
    .pipe(terser())
    .pipe(sourcemaps.write("./"))
    .pipe(gulp.dest("dist"));
}

gulp.task("copy-html", function () {
  return gulp.src(paths.pages).pipe(gulp.dest("dist"));
});

gulp.task("default", gulp.series(gulp.parallel("copy-html"), bundle));
watchedBrowserify.on("update", bundle);
watchedBrowserify.on("log", fancy_log);
