# ASU CDS Data

This project provides FHIR data and a turnkey FHIR controller for loading seed data used for Lee Informatics lab projects into a locally running FHIR resource server. See [GitHub](https://github.com/lee-informatics/asu-cds-data) for source.

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
