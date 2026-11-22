const hostname = "staging.aheedfoodcentre.co.uk";
const experimentHeader = "x-afc-homepage-script-priority";
const startupAsset = /^\/_next\/static\/[^?#]+\.js(?:[?#].*)?$/;

export function applyHomepageScriptPriority(request, environment, response) {
  const url = new URL(request.url);
  if (
    environment !== "staging" ||
    url.hostname !== hostname ||
    url.pathname !== "/" ||
    request.method !== "GET" ||
    !response.ok ||
    !response.headers.get("content-type")?.startsWith("text/html")
  ) {
    return response;
  }

  // Use the same deployed build for the control and candidate measurements.
  const control = request.headers.get(experimentHeader) === "control";
  const annotated = new Response(response.body, response);
  annotated.headers.set(experimentHeader, control ? "control" : "low");
  if (control) return annotated;

  return new HTMLRewriter()
    .on("script[src]", {
      element(element) {
        lowerScriptPriority(element, "src");
      },
    })
    .on('link[rel="preload"][as="script"][href]', {
      element(element) {
        lowerScriptPriority(element, "href");
      },
    })
    .transform(annotated);
}

function lowerScriptPriority(element, attribute) {
  if (startupAsset.test(element.getAttribute(attribute) ?? "")) {
    element.setAttribute("fetchpriority", "low");
  }
}
