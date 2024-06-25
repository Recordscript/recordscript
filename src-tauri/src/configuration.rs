use serde::{de::DeserializeOwned, Deserialize, Serialize};
use std::{path::PathBuf, time::Duration};

fn config_path<D>() -> PathBuf {
    let config_path = super::project_directory().config_dir().to_path_buf();

    std::fs::create_dir_all(&config_path).expect("Can't create config directory");

    config_path.join(format!("{}.bin", std::any::type_name::<D>()).replace("::", "-"))
}

fn document_path() -> PathBuf {
    let path = directories::UserDirs::new()
        .unwrap()
        .document_dir()
        .unwrap()
        .join("Transcriber");

    std::fs::create_dir_all(&path).expect("Can't create transcription directory");

    path
}

pub fn save<D>(data: &D)
where
    D: Serialize,
{
    let data = bincode::serialize(data).expect("Can't serialize config");

    std::fs::write(config_path::<D>(), data).expect("Can't save app configuration");
}

fn load<D>() -> anyhow::Result<D>
where
    D: DeserializeOwned,
{
    let data = std::fs::read(config_path::<D>())?;
    let data: D = bincode::deserialize(&data)?;

    Ok(data)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SavePathConfig {
    pub save_path: PathBuf,
    pub save_path_histories: Vec<PathBuf>,
}

impl Default for SavePathConfig {
    fn default() -> Self {
        Self {
            save_path: document_path(),
            save_path_histories: vec![document_path()],
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeneralConfig {
    pub transcription: SavePathConfig,
    pub transcription_email_to: String,
    pub video: SavePathConfig,
}

impl Default for GeneralConfig {
    fn default() -> Self {
        if let Ok(this) = load::<Self>() {
            return this;
        }

        let this = Self {
            transcription: SavePathConfig::default(),
            transcription_email_to: String::new(),
            video: SavePathConfig::default(),
        };

        save(&this);

        this
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SMTPConfig {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub password: String,
    pub from: String,
}

impl Default for SMTPConfig {
    fn default() -> Self {
        if let Ok(this) = load::<Self>() {
            return this;
        }

        let this = Self {
            host: String::new(),
            port: 465,
            username: String::new(),
            password: String::new(),
            from: String::new(),
        };

        save(&this);

        this
    }
}

impl SMTPConfig {
    pub fn auto_smtp_transport(&self) -> anyhow::Result<lettre::SmtpTransport> {
        use lettre::SmtpTransport;

        let creds = lettre::transport::smtp::authentication::Credentials::new(self.username.clone(), self.password.clone());
        
        let tls = || {
            println!("Trying to establish a TLS connection");

            let transport = SmtpTransport::relay(&self.host)?
                .port(self.port)
                .credentials(creds.clone())
                .timeout(Some(Duration::from_secs(10)))
                .build();

            match transport.test_connection() {
                Ok(false) => anyhow::bail!("Couldn't connect to SMTP server with TLS"),
                Err(e) => anyhow::bail!("Couldn't connect to SMTP server with TLS because:\n{e}"),
                _ => { }
            }

            Ok(transport)
        };

        let tls_over_plaintext = || {
            println!("Trying to establish a TLS connection over plaintext");

            let transport = SmtpTransport::starttls_relay(&self.host)?
                .port(self.port)
                .credentials(creds.clone())
                .timeout(Some(Duration::from_secs(10)))
                .build();

            match transport.test_connection() {
                Ok(false) => anyhow::bail!("Couldn't connect to SMTP server with TLS over plaintext"),
                Err(e) => anyhow::bail!("Couldn't connect to SMTP server with TLS over plaintext because:\n{e}"),
                _ => { }
            }

            Ok(transport)
        };

        let plaintext = || {
            println!("Trying to establish a plaintext connection");

            let transport = SmtpTransport::builder_dangerous(&self.host)
                .port(self.port)
                .credentials(creds.clone())
                .timeout(Some(Duration::from_secs(10)))
                .build();

            match transport.test_connection() {
                Ok(false) => anyhow::bail!("Couldn't connect to SMTP server with plaintext"),
                Err(e) => anyhow::bail!("Couldn't connect to SMTP server with plaintext because:\n{e}"),
                _ => { }
            }

            Ok(transport)
        };

        Ok(
            tls()
                .map_or_else(|_| tls_over_plaintext(), |t| Ok(t))
                .map_or_else(|_| plaintext(), |t| Ok(t))?
        )
    }
}

