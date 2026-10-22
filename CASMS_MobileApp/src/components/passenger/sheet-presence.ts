/** An interrupted exit must never hide a sheet that has already reopened. */
export function startSheetTransition(visible: boolean, start: (complete: (finished: boolean) => void) => () => void, onHidden: () => void) {
  let current = true;
  const stop = start(finished => {
    if (current && finished && !visible) onHidden();
  });
  return () => { current = false; stop(); };
}
