export function hideWindow(
  browserWindowToFadeOut,
  closeWindow = false,
  step = 0.1,
  fadeEveryXSeconds = 10
) {
  // Get the opacity of the window.
  let opacity = browserWindowToFadeOut.getOpacity();

  // Increase the opacity of the window by `step` every `fadeEveryXSeconds`
  // seconds.
  const interval = setInterval(() => {
    // Stop fading if window's opacity is 1 or greater.
    if (opacity <= 0) {
      clearInterval(interval);
      browserWindowToFadeOut.hide();
      if (closeWindow) {
        browserWindowToFadeOut.close();
      }
    }
    browserWindowToFadeOut.setOpacity(opacity);
    opacity -= step;
  }, fadeEveryXSeconds);
}

export function showWindow(
  browserWindowToFadeIn,
  step = 0.1,
  fadeEveryXSeconds = 10
) {
  // Get the opacity of the window.
  browserWindowToFadeIn.show();
  let opacity = browserWindowToFadeIn.getOpacity();

  // Increase the opacity of the window by `step` every `fadeEveryXSeconds`
  // seconds.
  const interval = setInterval(() => {
    // Stop fading if window's opacity is 1 or greater.
    if (opacity >= 1) {
      clearInterval(interval);
    }
    browserWindowToFadeIn.setOpacity(opacity);
    opacity += step;
  }, fadeEveryXSeconds);

  // Return the interval. Useful if we want to stop fading at will.
  return interval;
}
