function getFileCookie() {
  const elements = document.cookie.split(";");

  if (elements.length == 0) return null;

  const fileCookie = elements.filter((element) =>
    element.split("=")[0].includes("file")
  );
  if (fileCookie.length == 0) return null;

  const filename = fileCookie[0].split("=")[1].trim();
  return filename;
}

function setFileCookie(name) {
  document.cookie = "file=" + name;
}

export { getFileCookie, setFileCookie };
