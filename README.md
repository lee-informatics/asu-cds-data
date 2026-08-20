# ASU CDS Data

**This project has been archived and should no longer be used, as data files formerly in this repository have been moved to more appropriate projects.**

[![Docker pulls](https://shields.foundry.hl7.org/docker/pulls/p3000/asu-cds-data?logo=docker)](https://hub.docker.com/r/p3000/asu-cds-data)
[![Docker image size](https://shields.foundry.hl7.org/docker/image-size/p3000/asu-cds-data?logo=docker)](https://hub.docker.com/r/p3000/asu-cds-data)


This project provides a turnkey FHIR controller image and terminology **generation sources** for Lee Informatics lab projects. Runtime WMM CQL, ValueSets, and example patient Bundles now ship in the [asu-cds-wmm](https://github.com/lee-informatics/asu-cds-wmm) FHIR NPM package (`public/package/`). See that repository for `npm run package:fhir` and how to load sample data.

What remains here under `public/weight-management/` is the ValueSet generation pipeline (`csvs/`, `bin/`, `manifest.csv`). `bin/create-fhir-value-sets.ts` and `bin/bundle-value-sets.ts` still write JSON under `value-sets/` and `bundles/`; do not commit those regenerated outputs.

## Running Pre-Built Images

If using Docker:

```sh
docker run -it --rm -p 4204:80 --pull always p3000/asu-cds-data:latest
```

Use the application at: http://localhost:4204, which requires an open FHIR server with authorization disabled. We test and validate against HAPI FHIR in R4 mode, which we do not document here as ther vary across HAPI versions and context of use

To build your own:
```sh
docker buildx build --platform linux/arm64,linux/amd64 -t p3000/asu-cds-data:latest .
```

## License

Provided under the Apache 2.0 license. See LICENSE file for details.
