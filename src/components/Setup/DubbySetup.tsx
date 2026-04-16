import Button from '@app/components/Common/Button';
import defineMessages from '@app/utils/defineMessages';
import { ApiErrorCode } from '@server/constants/error';
import axios from 'axios';
import { Field, Form, Formik } from 'formik';
import { FormattedMessage, useIntl } from 'react-intl';
import { useToasts } from 'react-toast-notifications';
import validator from 'validator';
import * as Yup from 'yup';

const messages = defineMessages('components.Setup.DubbySetup', {
  hostname: 'Dubby URL',
  port: 'Port',
  enablessl: 'Use SSL',
  urlBase: 'URL Base',
  email: 'Email Address',
  username: 'Username',
  password: 'Password',
  signin: 'Sign In',
  signingin: 'Signing In…',
  validationhostrequired: 'Dubby URL required',
  validationemailrequired: 'You must provide a valid email address',
  validationemailformat: 'Valid email required',
  validationusernamerequired: 'Username required',
  validationpasswordrequired: 'You must provide a password',
  validationPortRequired: 'You must provide a valid port number',
  validationUrlBaseLeadingSlash: 'URL base must have a leading slash',
  validationUrlBaseTrailingSlash: 'URL base must not end in a trailing slash',
  loginerror: 'Something went wrong while trying to sign in.',
  invalidurlerror: 'Unable to connect to Dubby server.',
  adminalreadyexists: 'An admin user has already been configured.',
  back: 'Go back',
});

interface DubbySetupProps {
  revalidate: () => void;
  onCancel?: () => void;
}

function DubbySetup({ revalidate, onCancel }: DubbySetupProps) {
  const toasts = useToasts();
  const intl = useIntl();

  const SetupSchema = Yup.object().shape({
    hostname: Yup.string().required(
      intl.formatMessage(messages.validationhostrequired)
    ),
    port: Yup.number().required(
      intl.formatMessage(messages.validationPortRequired)
    ),
    urlBase: Yup.string()
      .test(
        'leading-slash',
        intl.formatMessage(messages.validationUrlBaseLeadingSlash),
        (value) => !value || value.startsWith('/')
      )
      .test(
        'trailing-slash',
        intl.formatMessage(messages.validationUrlBaseTrailingSlash),
        (value) => !value || !value.endsWith('/')
      ),
    email: Yup.string()
      .test(
        'email',
        intl.formatMessage(messages.validationemailformat),
        (value) => !value || validator.isEmail(value, { require_tld: false })
      )
      .required(intl.formatMessage(messages.validationemailrequired)),
    username: Yup.string().required(
      intl.formatMessage(messages.validationusernamerequired)
    ),
    password: Yup.string().required(
      intl.formatMessage(messages.validationpasswordrequired)
    ),
  });

  return (
    <Formik
      initialValues={{
        hostname: '',
        port: 3000,
        useSsl: false,
        urlBase: '',
        email: '',
        username: '',
        password: '',
      }}
      validationSchema={SetupSchema}
      onSubmit={async (values) => {
        try {
          await axios.post('/api/v1/auth/dubby', {
            hostname: values.hostname,
            port: values.port,
            useSsl: values.useSsl,
            urlBase: values.urlBase,
            email: values.email,
            username: values.username,
            password: values.password,
          });
        } catch (e) {
          let errorMessage = messages.loginerror;
          if (axios.isAxiosError(e)) {
            switch (e.response?.data?.message) {
              case ApiErrorCode.InvalidUrl:
                errorMessage = messages.invalidurlerror;
                break;
              case 'Admin user already exists.':
                errorMessage = messages.adminalreadyexists;
                break;
              default:
                errorMessage = messages.loginerror;
                break;
            }
          }

          toasts.addToast(intl.formatMessage(errorMessage), {
            autoDismiss: true,
            appearance: 'error',
          });
        } finally {
          revalidate();
        }
      }}
    >
      {({ errors, touched, values, setFieldValue, isSubmitting, isValid }) => (
        <Form>
          <div className="sm:border-t sm:border-gray-800">
            <div className="flex flex-col sm:flex-row sm:gap-4">
              <div className="w-full">
                <label htmlFor="hostname" className="text-label">
                  {intl.formatMessage(messages.hostname)}
                </label>
                <div className="mb-2 mt-1 sm:col-span-2 sm:mb-0 sm:mt-0">
                  <div className="flex rounded-md shadow-sm">
                    <span className="inline-flex cursor-default items-center rounded-l-md border border-r-0 border-gray-500 bg-gray-800 px-3 text-gray-100 sm:text-sm">
                      {values.useSsl ? 'https://' : 'http://'}
                    </span>
                    <Field
                      id="hostname"
                      name="hostname"
                      type="text"
                      className="rounded-r-only flex-1"
                      placeholder={intl.formatMessage(messages.hostname)}
                      autoComplete="off"
                      data-form-type="other"
                      data-1pignore="true"
                      data-lpignore="true"
                      data-bwignore="true"
                    />
                  </div>
                  {errors.hostname && touched.hostname && (
                    <div className="error">{errors.hostname}</div>
                  )}
                </div>
              </div>
              <div className="flex-1">
                <label htmlFor="port" className="text-label">
                  {intl.formatMessage(messages.port)}
                </label>
                <div className="mt-1 sm:mt-0">
                  <Field
                    id="port"
                    name="port"
                    inputMode="numeric"
                    type="text"
                    className="short flex-1"
                    placeholder={intl.formatMessage(messages.port)}
                  />
                  {errors.port && touched.port && (
                    <div className="error">{errors.port}</div>
                  )}
                </div>
              </div>
            </div>
            <label htmlFor="useSsl" className="text-label mt-2">
              {intl.formatMessage(messages.enablessl)}
            </label>
            <div className="mb-2 mt-1 sm:col-span-2">
              <div className="flex rounded-md shadow-sm">
                <Field
                  id="useSsl"
                  name="useSsl"
                  type="checkbox"
                  onChange={() => {
                    setFieldValue('useSsl', !values.useSsl);
                    setFieldValue('port', values.useSsl ? 3000 : 443);
                  }}
                />
              </div>
            </div>
            <label htmlFor="urlBase" className="text-label mt-1">
              {intl.formatMessage(messages.urlBase)}
            </label>
            <div className="mb-2 mt-1 sm:col-span-2 sm:mt-0">
              <div className="flex rounded-md shadow-sm">
                <Field
                  type="text"
                  inputMode="url"
                  id="urlBase"
                  name="urlBase"
                  placeholder={intl.formatMessage(messages.urlBase)}
                />
              </div>
              {errors.urlBase && touched.urlBase && (
                <div className="error">{errors.urlBase}</div>
              )}
            </div>
            <label htmlFor="email" className="text-label mt-1">
              {intl.formatMessage(messages.email)}
            </label>
            <div className="mb-2 mt-1 sm:col-span-2 sm:mt-0">
              <div className="flex rounded-md shadow-sm">
                <Field
                  id="email"
                  name="email"
                  type="text"
                  placeholder={intl.formatMessage(messages.email)}
                  autoComplete="off"
                  data-form-type="other"
                  data-1pignore="true"
                  data-lpignore="true"
                  data-bwignore="true"
                />
              </div>
              {errors.email && touched.email && (
                <div className="error">{errors.email}</div>
              )}
            </div>
            <label htmlFor="username" className="text-label">
              {intl.formatMessage(messages.username)}
            </label>
            <div className="mb-2 mt-1 sm:col-span-2 sm:mt-0">
              <div className="flex rounded-md shadow-sm">
                <Field
                  id="username"
                  name="username"
                  type="text"
                  placeholder={intl.formatMessage(messages.username)}
                  autoComplete="off"
                  data-form-type="other"
                  data-1pignore="true"
                  data-lpignore="true"
                  data-bwignore="true"
                />
              </div>
              {errors.username && touched.username && (
                <div className="error">{errors.username}</div>
              )}
            </div>
            <label htmlFor="password" className="text-label">
              {intl.formatMessage(messages.password)}
            </label>
            <div className="mb-2 mt-1 sm:col-span-2 sm:mt-0">
              <div className="flex rounded-md shadow-sm">
                <Field
                  id="password"
                  name="password"
                  type="password"
                  placeholder={intl.formatMessage(messages.password)}
                  autoComplete="off"
                  data-form-type="other"
                  data-1pignore="true"
                  data-lpignore="true"
                  data-bwignore="true"
                />
              </div>
              {errors.password && touched.password && (
                <div className="error">{errors.password}</div>
              )}
            </div>
          </div>
          <div className="mt-8 border-t border-gray-700 pt-5">
            <div className="flex flex-row-reverse justify-between">
              <span className="inline-flex rounded-md shadow-sm">
                <Button
                  buttonType="primary"
                  type="submit"
                  disabled={isSubmitting || !isValid}
                >
                  {isSubmitting
                    ? intl.formatMessage(messages.signingin)
                    : intl.formatMessage(messages.signin)}
                </Button>
              </span>
              {onCancel && (
                <span className="inline-flex rounded-md shadow-sm">
                  <Button buttonType="default" onClick={() => onCancel()}>
                    <FormattedMessage {...messages.back} />
                  </Button>
                </span>
              )}
            </div>
          </div>
        </Form>
      )}
    </Formik>
  );
}

export default DubbySetup;
