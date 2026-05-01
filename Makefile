NAME    = jobtint
VERSION = 1.13

ZIP     = dist/$(NAME)-v$(VERSION).zip
FILES   = manifest.json content.js styles.css popup/ icons/

.PHONY: all package clean help

all: package

package:
	@echo "Packaging $(NAME) v$(VERSION)..."
	@mkdir -p dist
	@rm -f $(ZIP)
	@zip -r $(ZIP) $(FILES)
	@echo "Done -> $(ZIP)"

clean:
	@rm -rf dist/

help:
	@echo "Available targets:"
	@echo "  all      - Build the extension zip (default)"
	@echo "  package  - Create dist/$(NAME)-v$(VERSION).zip"
	@echo "  clean    - Remove the dist/ directory"
	@echo "  help     - Show this help message"
