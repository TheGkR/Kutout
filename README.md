<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="logo-light.png">
    <img src="logo.png" alt="GK logo" width="120">
  </picture>
</p>

# Kutout

Remove the background from an image, right in your browser. An AI segmentation model runs on your device, so your images are never uploaded to a server.

**Live demo:** https://thegkr.github.io/Kutout/

## Features

- Drag and drop, or choose an image (JPG, PNG, WebP)
- Before/after comparison slider
- Backgrounds: transparent, white, dark, any custom color, or an image of your own
- Download the result as a PNG
- No build step, no backend, no tracking

## Run it locally

The page uses ES modules, web workers and WebAssembly, so it must be served over HTTP. Opening `index.html` directly from disk will not work.

```bash
git clone https://github.com/TheGkR/Kutout.git
cd Kutout
python -m http.server 8000
```

Then open http://localhost:8000.

The first image downloads the model (roughly 40–80 MB). The browser caches it, so later images are much faster.

## Deploy with GitHub Pages

1. Push this repository to GitHub.
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, select `main` and `/ (root)`, then save.
4. Your site appears at `https://thegkr.github.io/Kutout/` after a minute or two.

## Project structure

```
index.html   Page markup
logo.png     Creator logo (logo-light.png is the dark-mode version)
favicon.png  Browser tab icon
style.css    Styles (light and dark mode)
script.js    Upload, background removal, comparison slider, backgrounds, download
LICENSE      GNU AGPL v3
```

## How it works

`script.js` imports [`@imgly/background-removal`](https://github.com/imgly/background-removal-js) from the jsDelivr CDN and calls `removeBackground(file)`, which returns a transparent PNG blob. The comparison view stacks the original photo and the result and clips the top layer with a CSS `clip-path`. Download redraws the result onto a canvas, fills the chosen background (a color, or an image scaled to cover), and exports a full-resolution PNG.

The library version is pinned in the import line at the top of `script.js`. After changing it, test the page, because newer releases may need extra setup such as the `onnxruntime-web` peer dependency.

## Contributing

Issues and pull requests are welcome. Good first ideas:

- Batch processing of several images
- A brush to restore or erase parts of the cutout
- Background image position and blur controls
- Batch processing of several images
- Self-hosting the model files for offline use

Please keep the project dependency-free and buildless where possible.

## Author

Created by [TheGkR](https://github.com/TheGkR).

## License

Licensed under the [GNU Affero General Public License v3.0](LICENSE).

This project uses [`@imgly/background-removal`](https://github.com/imgly/background-removal-js), which is also released under AGPL-3.0. Because this is a network service, the AGPL requires that users can get the corresponding source code. The footer link to this repository serves that purpose, so keep it in place if you fork or modify the site.
